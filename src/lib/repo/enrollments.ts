import {
  collection, getDocs, doc, deleteDoc, updateDoc, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { Enrollment, ClassRecord } from "../../types";

const COL = "enrollments";

/* Document ID ghép từ lớp và học viên, nên cùng một người không thể có hai
   bản ghi trong cùng một lớp — ràng buộc nằm ở tầng lưu trữ chứ không phải
   ở tầng giao diện. */
export const enrollmentId = (classId: string, studentId: string) => `${classId}_${studentId}`;

export interface NewEnrollment {
  classId: string;
  studentId: string;
  level: "L1" | "L2" | "L3";
  matchScore: number | null;
  matchReason: string | null;
}

export async function fetchEnrollments(): Promise<Enrollment[]> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Enrollment[];
}

/* Ghi cả loạt trong một batch: giáo vụ bấm "Lưu tất cả" một lần thì hoặc
   vào hết, hoặc không vào gì — không có trạng thái xếp được nửa danh sách. */
export async function saveEnrollments(rows: NewEnrollment[], enrolledBy: string): Promise<number> {
  const CHUNK = 400;   // Firestore giới hạn 500 thao tác mỗi batch
  let written = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const r of rows.slice(i, i + CHUNK)) {
      batch.set(doc(db, COL, enrollmentId(r.classId, r.studentId)), {
        classId: r.classId,
        studentId: r.studentId,
        level: r.level,
        status: "enrolled",
        matchScore: r.matchScore,
        matchReason: r.matchReason,
        enrolledAt: serverTimestamp(),
        enrolledBy,
      });
      written++;
    }
    await batch.commit();
  }
  return written;
}

export async function unenroll(classId: string, studentId: string): Promise<void> {
  await deleteDoc(doc(db, COL, enrollmentId(classId, studentId)));
}

/* enrolledCount là số phi chuẩn hóa nên có thể lệch khi ghi lỗi giữa chừng.
   Đếm lại từ nguồn sự thật (số document enrollments) và chỉ ghi những lớp
   thật sự sai, để không tốn lượt ghi vô ích. Trả về số lớp đã sửa. */
export async function recountClassEnrollments(
  classes: ClassRecord[], enrollments: Enrollment[]
): Promise<number> {
  const actual = new Map<string, number>();
  for (const e of enrollments) {
    if (e.status !== "enrolled") continue;
    actual.set(e.classId, (actual.get(e.classId) || 0) + 1);
  }

  let fixed = 0;
  for (const c of classes) {
    if (!c.id) continue;
    const real = actual.get(c.id) || 0;
    if ((c.enrolledCount || 0) !== real) {
      await updateDoc(doc(db, "classes", c.id), { enrolledCount: real, updatedAt: serverTimestamp() });
      fixed++;
    }
  }
  return fixed;
}
