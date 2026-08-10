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

/* Phiếu thiếu submittedAt (dữ liệu cũ) coi như mốc 0 để không bao giờ
   thắng phiếu có ngày thật khi chọn "phiếu mới nhất". */
const submittedSeconds = (s: SurveySubmission): number => s.submittedAt?.seconds || 0;

export function buildStudentsFromSubmissions(
  subs: SurveySubmission[]
): { drafts: StudentDraft[]; skipped: SkippedSubmission[] } {
  const byEmail = new Map<string, { latest: SurveySubmission; count: number }>();
  const skipped: SkippedSubmission[] = [];

  for (const s of subs) {
    const key = normalizeEmail(s.email);
    if (!key) {
      skipped.push({
        submissionId: s.id || "",
        studentName: s.studentName || "(không tên)",
        reason: "Thiếu email hợp lệ",
      });
      continue;
    }

    const existing = byEmail.get(key);
    if (!existing) {
      byEmail.set(key, { latest: s, count: 1 });
    } else {
      byEmail.set(key, {
        latest: submittedSeconds(s) > submittedSeconds(existing.latest) ? s : existing.latest,
        count: existing.count + 1,
      });
    }
  }

  const drafts: StudentDraft[] = Array.from(byEmail.entries()).map(([id, { latest, count }]) => ({
    id,
    email: latest.email,
    fullName: latest.studentName,
    department: latest.department,
    phone: latest.phone,
    currentLevel: latest.assignedLevel,
    latestSubmissionId: latest.id || "",
    submissionCount: count,
    availability: {
      timeframes: latest.answers?.q10_timeframe || [],
      days: latest.answers?.q11_days || [],
      duration: latest.answers?.q12_duration || "",
    },
  }));

  return { drafts, skipped };
}
