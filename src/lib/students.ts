import {
  SurveySubmission, Student, StudentDraft, SkippedSubmission, DuplicateGroup,
} from "../types";

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

/* Một cặp coi như đã xử lý nếu BẤT KỲ bên nào đánh dấu bên kia là không trùng —
   giáo vụ đã quyết một lần rồi thì đừng hỏi lại từ phía còn lại. */
function pairDismissed(a: Student, b: Student): boolean {
  return (a.notDuplicateOf || []).includes(b.id || "")
    || (b.notDuplicateOf || []).includes(a.id || "");
}

/* Nghi trùng = cùng tên + cùng khoa/phòng nhưng khác email. Chỉ gợi ý cho
   giáo vụ xem lại, không bao giờ tự gộp: hai người trùng tên trong cùng một
   khoa là chuyện có thật. */
export function findDuplicateGroups(students: Student[]): DuplicateGroup[] {
  const buckets = new Map<string, Student[]>();

  for (const s of students) {
    const name = normalizeName(s.fullName);
    const dept = normalizeName(s.department);
    if (!name || !dept) continue;   // thiếu một trong hai thì không đủ căn cứ
    const key = `${name}|${dept}`;
    buckets.set(key, [...(buckets.get(key) || []), s]);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, members] of buckets) {
    if (members.length < 2) continue;

    // Còn ít nhất một cặp chưa được giáo vụ xử lý thì mới đáng báo.
    let hasOpenPair = false;
    for (let i = 0; i < members.length && !hasOpenPair; i++) {
      for (let j = i + 1; j < members.length; j++) {
        if (!pairDismissed(members[i], members[j])) { hasOpenPair = true; break; }
      }
    }
    if (!hasOpenPair) continue;

    groups.push({
      key,
      fullName: members[0].fullName,
      department: members[0].department,
      students: members,
    });
  }

  return groups.sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));
}
