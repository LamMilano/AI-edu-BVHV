import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { ClassRecord } from "../../types";
import { parseLegacySchedule } from "../classSchedule";

const COL = "classes";

/* Document cũ chỉ có schedule (chuỗi chữ) và studentsCount. Dựng khung lịch
   có cấu trúc ngay lúc đọc, để giao diện không phải biết tới định dạng cũ.
   Việc ghi đè hẳn xuống Firestore do migrateClasses() làm, có xác nhận. */
function normalizeClass(id: string, raw: any): ClassRecord {
  const legacy = !raw.plannedSchedule;
  return {
    id,
    level: raw.level,
    name: raw.name || "",
    instructor: raw.instructor || "",
    room: raw.room || "",
    capacity: raw.capacity ?? raw.studentsCount ?? 0,
    plannedSchedule: raw.plannedSchedule || parseLegacySchedule(raw.name || "", raw.schedule || ""),
    // Lớp cũ đang chạy thật rồi, nên mặc định "active" chứ không phải "planning".
    status: raw.status || (legacy ? "active" : "planning"),
    enrolledCount: raw.enrolledCount ?? 0,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function fetchClasses(): Promise<ClassRecord[]> {
  const snap = await getDocs(collection(db, COL));
  const list = snap.docs.map(d => normalizeClass(d.id, d.data()));
  return list.sort((a, b) => a.level.localeCompare(b.level) || a.name.localeCompare(b.name, "vi"));
}

/* id === null nghĩa là thêm mới. Gộp hai trường hợp vào một hàm để
   component không phải rẽ nhánh addDoc/updateDoc. */
export async function saveClass(
  id: string | null,
  data: Omit<ClassRecord, "id" | "createdAt" | "updatedAt">
): Promise<void> {
  if (id) {
    await updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
  } else {
    await addDoc(collection(db, COL), {
      ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  }
}

export async function deleteClass(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

/* Ghi hẳn khung lịch có cấu trúc xuống Firestore. Lớp nào không dò được ngày
   nào thì báo về để giáo vụ khai lại bằng tay — đoán bừa còn tệ hơn để trống,
   vì điểm khớp sai sẽ không ai phát hiện ra. */
export async function migrateClasses(): Promise<{ converted: number; needsReview: string[] }> {
  const snap = await getDocs(collection(db, COL));
  let converted = 0;
  const needsReview: string[] = [];

  for (const d of snap.docs) {
    const raw = d.data() as any;
    if (raw.plannedSchedule) continue;   // đã chuyển rồi — nên chạy lại được nhiều lần

    const planned = parseLegacySchedule(raw.name || "", raw.schedule || "");
    await updateDoc(doc(db, COL, d.id), {
      plannedSchedule: planned,
      capacity: raw.capacity ?? raw.studentsCount ?? 0,
      status: raw.status || "active",
      enrolledCount: raw.enrolledCount ?? 0,
      updatedAt: serverTimestamp(),
    });
    converted++;
    if (planned.days.length === 0) needsReview.push(raw.name || d.id);
  }

  return { converted, needsReview };
}
