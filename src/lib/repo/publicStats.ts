import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { PublicStatsData } from "../../types";

const COL = "public_stats";
const DOC_ID = "summary";

/* Trả null khi chưa có document — trang chủ dựa vào đó để ẩn khối thống kê
   thay vì hiển thị một dãy số 0 trông như chương trình không có ai học. */
export async function fetchPublicStats(): Promise<PublicStatsData | null> {
  const snap = await getDoc(doc(db, COL, DOC_ID));
  if (!snap.exists()) return null;
  return snap.data() as PublicStatsData;
}

export async function writePublicStats(stats: PublicStatsData): Promise<void> {
  await setDoc(doc(db, COL, DOC_ID), { ...stats, updatedAt: serverTimestamp() });
}
