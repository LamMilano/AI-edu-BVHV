import {
  collection, getDocs, getDoc, updateDoc, deleteDoc, doc, query, where,
  arrayUnion, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { Student, StudentDraft } from "../../types";
import { enrollmentId } from "./enrollments";

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

/* Gộp hai hồ sơ: giữ keepId, xóa dropId, ghi vết vào mergedFrom.
   Ghi danh của dropId phải được trỏ sang keepId TRƯỚC khi xóa hồ sơ, nếu
   không những bản ghi đó thành mồ côi — trỏ tới một học viên không còn tồn
   tại, và học viên đó biến mất khỏi danh sách lớp mà không ai biết vì sao.

   GĐ4: khi có collection sessions, hàm này còn phải đổi khóa trong
   sessions.records từ dropId sang keepId. */
export async function mergeStudents(keepId: string, dropId: string): Promise<void> {
  const dropSnap = await getDoc(doc(db, COL, dropId));
  const dropData = dropSnap.exists() ? (dropSnap.data() as Student) : null;

  const dropEnrollments = await getDocs(
    query(collection(db, "enrollments"), where("studentId", "==", dropId))
  );

  /* Phải đọc hết trạng thái "người giữ lại đã ở lớp nào" TRƯỚC khi mở batch:
     writeBatch không đọc được, và await xen giữa các lệnh batch làm thứ tự
     khó lần khi có lỗi. */
  const existingTargets = await Promise.all(
    dropEnrollments.docs.map(enr => {
      const { classId } = enr.data() as { classId: string };
      return getDoc(doc(db, "enrollments", enrollmentId(classId, keepId)));
    })
  );

  const batch = writeBatch(db);

  dropEnrollments.docs.forEach((enr, idx) => {
    const data = enr.data() as Record<string, unknown>;
    const classId = data.classId as string;

    /* Người giữ lại đã có ghi danh ở đúng lớp đó thì bản ghi kia là thừa —
       xóa đi thay vì ghi đè, vì ghi đè sẽ mất mốc enrolledAt cũ của họ. */
    if (!existingTargets[idx].exists()) {
      batch.set(doc(db, "enrollments", enrollmentId(classId, keepId)), {
        ...data, studentId: keepId,
      });
    }
    batch.delete(enr.ref);
  });

  batch.update(doc(db, COL, keepId), {
    mergedFrom: arrayUnion(dropId, ...(dropData?.mergedFrom || [])),
    updatedAt: serverTimestamp(),
  });
  batch.delete(doc(db, COL, dropId));

  await batch.commit();
}
