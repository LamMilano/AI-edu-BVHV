import { SurveySubmission, StudentDraft, SkippedSubmission } from "../types";

/* Giới hạn của Firestore Document ID: không chứa '/', không phải '.' hay '..',
   tối đa 1500 byte UTF-8. Email hợp lệ không vi phạm những điều này, nhưng dữ
   liệu người dùng gõ tay thì có thể, nên phải chặn trước khi ghi. */
const MAX_DOC_ID_BYTES = 1500;

export function normalizeEmail(raw: string): string | null {
  const value = (raw || "").trim().toLowerCase();
  if (!value) return null;
  if (value === "." || value === "..") return null;
  if (value.includes("/")) return null;
  if (!value.includes("@")) return null;
  if (new TextEncoder().encode(value).length > MAX_DOC_ID_BYTES) return null;
  return value;
}

/* Dùng để phát hiện trùng tên. GIỮ NGUYÊN dấu tiếng Việt: bỏ dấu sẽ gộp nhầm
   những cái tên khác hẳn nhau (Lê Hồng vs Lê Hòng), mà mục đích ở đây chỉ là
   gợi ý cho giáo vụ xem lại chứ không phải tự động gộp. */
export function normalizeName(raw: string): string {
  return (raw || "").trim().toLowerCase().replace(/\s+/g, " ");
}
