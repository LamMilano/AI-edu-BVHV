import { Student, SurveySubmission, Enrollment, ClassRecord } from "../types";
import { LEVEL_LABEL } from "./levels";
import { SURVEY_LABELS, flattenAnswers } from "./survey";
import { formatDateVN } from "./datetime";

export interface StudentExportInput {
  students: Student[];
  submissions: SurveySubmission[];
  enrollments: Enrollment[];
  classes: ClassRecord[];
  /** null = xuất toàn bộ hồ sơ; có giá trị = chỉ học viên đang học lớp đó. */
  classId: string | null;
}

export interface StudentExportTable {
  header: string[];
  rows: (string | number)[][];
}

/* Cột định danh đứng trước, câu hỏi khảo sát đứng sau. Giáo vụ mở file lên là
   thấy ngay ai với ai; phần trả lời dài để dạt sang phải, cuộn tới khi cần. */
const PROFILE_COLUMNS = [
  "STT",
  "Họ tên",
  "Email",
  "Điện thoại",
  "Khoa / Phòng",
  "Cấp độ hiện tại",
  "Lớp đang học",
  "Điểm khảo sát",
  "Cấp độ đề xuất",
  "Ngày nộp phiếu",
  "Số phiếu đã nộp",
];

export const STUDENT_EXPORT_HEADER: string[] = [
  ...PROFILE_COLUMNS,
  ...Object.values(SURVEY_LABELS),
];

/* Độ rộng cột tính theo ký tự. Cột khảo sát rộng đều nhau vì câu trả lời dài
   ngắn khó lường; cột định danh đo theo nội dung thật (email dài nhất). */
const PROFILE_WIDTHS = [6, 24, 28, 14, 24, 14, 24, 12, 14, 14, 12];
const ANSWER_WIDTH = 34;

export const STUDENT_EXPORT_WIDTHS: number[] = [
  ...PROFILE_WIDTHS,
  ...Object.keys(SURVEY_LABELS).map(() => ANSWER_WIDTH),
];

/* Bỏ dấu tiếng Việt rồi gộp mọi thứ còn lại thành gạch nối. Tên file đi qua
   email, Windows, macOS và ổ chia sẻ — chữ có dấu ở đó lúc được lúc hỏng. */
const slugify = (text: string): string =>
  text
    .normalize("NFD")
    /* Dải ̀-ͯ là các dấu thanh và dấu mũ đã tách ra sau NFD.
       Chữ đ không tách được nên phải thay riêng. */
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Tên file xuất, ví dụ `hoc-vien-lop-l1-k1-2026-08-14.xlsx`. */
export function studentExportFileName(scopeLabel: string, today: Date): string {
  const stamp = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  return ["hoc-vien", slugify(scopeLabel), stamp].filter(Boolean).join("-") + ".xlsx";
}

/** Dựng bảng danh sách học viên kèm toàn bộ câu trả lời khảo sát.
 *
 *  Trả về dữ liệu thuần (tiêu đề + các dòng), không dính gì tới định dạng
 *  file: cùng một bảng này ghi ra Excel hay CSV đều được. */
export function buildStudentExport(input: StudentExportInput): StudentExportTable {
  const { students, submissions, enrollments, classes, classId } = input;

  const subById = new Map(submissions.map(s => [s.id, s]));
  const classNameById = new Map(classes.map(c => [c.id, c.name]));

  /* Chỉ ghi danh còn hiệu lực mới tính. Người đã chuyển lớp hoặc đã nghỉ vẫn
     còn document ghi danh, nhưng họ không thuộc lớp đó nữa. */
  const activeEnrollments = enrollments.filter(e => e.status === "enrolled");

  const classNamesOf = (studentId: string): string =>
    activeEnrollments
      .filter(e => e.studentId === studentId)
      .map(e => classNameById.get(e.classId) || "")
      .filter(Boolean)
      .join("; ");

  const inScope = classId
    ? students.filter(s =>
        activeEnrollments.some(e => e.classId === classId && e.studentId === s.id))
    : students;

  const rows = inScope.map((s, i) => {
    const sub = (s.latestSubmissionId && subById.get(s.latestSubmissionId)) || null;
    return [
      i + 1,
      s.fullName || "",
      s.email || "",
      s.phone || "",
      s.department || "",
      LEVEL_LABEL[s.currentLevel] || "",
      classNamesOf(s.id || ""),
      /* Để số nguyên chứ không phải "72/100": Excel còn lọc và tính trung bình được. */
      sub ? sub.score : "",
      sub ? LEVEL_LABEL[sub.assignedLevel] || "" : "",
      sub ? formatDateVN(sub.submittedAt) : "",
      s.submissionCount ?? 0,
      ...flattenAnswers(sub),
    ];
  });

  return { header: STUDENT_EXPORT_HEADER, rows };
}
