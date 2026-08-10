import {
  collection, getDocs, getDoc, updateDoc, deleteDoc, doc,
  arrayUnion, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { Student, StudentDraft } from "../../types";

const COL = "students";

export async function fetchStudents(): Promise<Student[]> {
  const snap = await getDocs(collection(db, COL));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Student[];
  return list.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "", "vi"));
}

/* Ghi hàng loạt hồ sơ. Chạy lại nhiều lần không nhân đôi vì Document ID là
   email: lần sau chỉ ghi đè. Đọc trước để giữ nguyên createdAt và những
   trường do giáo vụ quyết định (notDuplicateOf, mergedFrom) — nếu ghi đè
   thẳng thì mỗi lần dựng lại hồ sơ sẽ làm sống dậy các nhóm nghi trùng đã xử lý. */
export async function upsertStudentDrafts(
  drafts: StudentDraft[]
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  // Firestore giới hạn 500 thao tác mỗi batch.
  const CHUNK = 400;
  for (let i = 0; i < drafts.length; i += CHUNK) {
    const slice = drafts.slice(i, i + CHUNK);
    const existing = await Promise.all(slice.map(d => getDoc(doc(db, COL, d.id))));

    const batch = writeBatch(db);
    slice.forEach((draft, idx) => {
      const snap = existing[idx];
      const prev = snap.exists() ? (snap.data() as Student) : null;
      if (prev) updated++; else created++;

      /* Bỏ id ra khỏi phần thân: nó đã là Document ID rồi. Ghi cả hai chỗ thì
         fetchStudents (trải data() lên sau {id: d.id}) sẽ lấy bản trong thân,
         và hai giá trị này có thể lệch nhau sau một lần gộp hồ sơ. */
      const { id: _id, ...body } = draft;
      batch.set(doc(db, COL, draft.id), {
        ...body,
        notDuplicateOf: prev?.notDuplicateOf || [],
        mergedFrom: prev?.mergedFrom || [],
        createdAt: prev?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return { created, updated };
}

/* Đánh dấu hai chiều: nếu chỉ ghi một chiều, xóa rồi tạo lại hồ sơ kia là
   nhóm nghi trùng hiện lại. */
export async function markNotDuplicate(idA: string, idB: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, COL, idA), { notDuplicateOf: arrayUnion(idB), updatedAt: serverTimestamp() });
  batch.update(doc(db, COL, idB), { notDuplicateOf: arrayUnion(idA), updatedAt: serverTimestamp() });
  await batch.commit();
}

/* Gộp: giữ keepId, xóa dropId, ghi vết vào mergedFrom.
   NỢ KỸ THUẬT GĐ3: khi có enrollments/sessions, hàm này phải trỏ lại mọi
   ghi danh và bản ghi điểm danh của dropId sang keepId TRƯỚC khi xóa. */
export async function mergeStudents(keepId: string, dropId: string): Promise<void> {
  const dropSnap = await getDoc(doc(db, COL, dropId));
  const dropData = dropSnap.exists() ? (dropSnap.data() as Student) : null;

  await updateDoc(doc(db, COL, keepId), {
    mergedFrom: arrayUnion(dropId, ...(dropData?.mergedFrom || [])),
    updatedAt: serverTimestamp(),
  });
  await deleteDoc(doc(db, COL, dropId));
}
