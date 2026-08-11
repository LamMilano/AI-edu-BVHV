import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
  runTransaction, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Session, AttendanceStatus } from "../../types";

const COL = "sessions";

export interface NewSession {
  classId: string;
  date: string;
  startTime: string;
  durationMin: number;
  topic: string;
}

/* Ném khi buổi học đã bị người khác lưu kể từ lúc màn hình này mở lên.
   Mang theo mốc thời gian để thông báo nói được "vừa được lưu lúc mấy giờ". */
export class AttendanceConflictError extends Error {
  takenAtMs: number | null;
  constructor(takenAtMs: number | null) {
    super("attendance-conflict");
    this.name = "AttendanceConflictError";
    this.takenAtMs = takenAtMs;
  }
}

/* KHÔNG dùng orderBy: buổi cũ có thể thiếu createdAt và sẽ bị Firestore loại
   khỏi kết quả. Sắp bằng chuỗi ngày ISO trong bộ nhớ. */
export async function fetchSessions(): Promise<Session[]> {
  const snap = await getDocs(collection(db, COL));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Session[];
  return list.sort((a, b) =>
    (a.date || "").localeCompare(b.date || "") ||
    (a.startTime || "").localeCompare(b.startTime || "")
  );
}

export async function createSession(input: NewSession): Promise<void> {
  await addDoc(collection(db, COL), {
    ...input,
    status: "scheduled",
    records: {},
    note: "",
    takenBy: null,
    takenAt: null,
    createdAt: serverTimestamp(),
  });
}

export async function updateSessionStatus(
  sessionId: string, status: Session["status"]
): Promise<void> {
  await updateDoc(doc(db, COL, sessionId), { status });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await deleteDoc(doc(db, COL, sessionId));
}

export const takenAtMillis = (ts: unknown): number | null =>
  ts instanceof Timestamp ? ts.toMillis() : null;

/* Lưu điểm danh trong một transaction, so mốc takenAt đọc được lúc mở màn
   hình với mốc hiện tại trên máy chủ. Lệch nghĩa là người khác vừa lưu buổi
   này — ném lỗi để giao diện hỏi lại, thay vì âm thầm đè mất công của họ. */
export async function saveAttendance(args: {
  sessionId: string;
  records: Record<string, AttendanceStatus>;
  note: string;
  takenBy: string;
  expectedTakenAtMs: number | null;
}): Promise<void> {
  const ref = doc(db, COL, args.sessionId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Buổi học không còn tồn tại.");

    const currentMs = takenAtMillis(snap.data().takenAt);
    if (currentMs !== args.expectedTakenAtMs) {
      throw new AttendanceConflictError(currentMs);
    }

    tx.update(ref, {
      records: args.records,
      note: args.note,
      status: "done",
      takenBy: args.takenBy,
      takenAt: serverTimestamp(),
    });
  });
}
