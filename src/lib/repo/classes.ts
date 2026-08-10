import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { ClassSession } from "../../types";

const COL = "classes";

export async function fetchClasses(): Promise<ClassSession[]> {
  const snap = await getDocs(collection(db, COL));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ClassSession[];
  return list.sort((a, b) => a.level.localeCompare(b.level));
}

/* id === null nghĩa là thêm mới. Gộp hai trường hợp vào một hàm để
   component không phải rẽ nhánh addDoc/updateDoc. */
export async function saveClass(
  id: string | null,
  data: Omit<ClassSession, "id">
): Promise<void> {
  if (id) {
    await updateDoc(doc(db, COL, id), data);
  } else {
    await addDoc(collection(db, COL), data);
  }
}

export async function deleteClass(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
