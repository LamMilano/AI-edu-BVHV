import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { SurveySubmission } from "../../types";

const COL = "survey_submissions";

/* KHÔNG dùng orderBy("submittedAt"): Firestore loại khỏi kết quả mọi
   document thiếu trường được sắp xếp, nên phiếu cũ sẽ biến mất. Sắp xếp
   trong bộ nhớ, phiếu thiếu ngày đẩy xuống cuối. */
export async function fetchSubmissions(): Promise<SurveySubmission[]> {
  const snap = await getDocs(collection(db, COL));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as SurveySubmission[];
  return list.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
}

export async function createSubmission(
  data: Omit<SurveySubmission, "id" | "submittedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COL), { ...data, submittedAt: serverTimestamp() });
  return ref.id;
}

export async function deleteSubmission(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
