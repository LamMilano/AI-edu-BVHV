import {
  collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";
import { Announcement } from "../../types";

const COL = "announcements";

/* Thông báo luôn được tạo qua createAnnouncement nên chắc chắn có createdAt;
   dùng orderBy ở đây an toàn, khác với survey_submissions. */
export async function fetchAnnouncements(): Promise<Announcement[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Announcement[];
}

export async function createAnnouncement(input: {
  title: string;
  content: string;
  category: Announcement["category"];
}): Promise<void> {
  await addDoc(collection(db, COL), {
    ...input,
    // Giữ định dạng vi-VN như trước khi tách repo: trường date được hiển thị
    // thẳng ra giao diện, đổi sang ISO là đổi luôn cái người dùng nhìn thấy.
    date: new Date().toLocaleDateString("vi-VN"),
    createdAt: serverTimestamp(),
  });
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
