import { describe, it, expect } from "vitest";
import {
  buildStudentExport, studentExportFileName, STUDENT_EXPORT_HEADER, STUDENT_EXPORT_WIDTHS,
} from "./exportStudents";
import { Student, SurveySubmission, Enrollment, ClassRecord } from "../types";

/* ── Đồ gá dựng dữ liệu ─────────────────────────────────────────
   Chỉ khai những trường mỗi phép thử quan tâm; phần còn lại lấy mặc định
   để test đọc được ý định thay vì đọc được hình dạng Firestore. */

const student = (over: Partial<Student> & { id: string }): Student => ({
  email: `${over.id}@bvhv.vn`,
  fullName: "Học viên",
  department: "Khoa Nội",
  phone: "0900000000",
  currentLevel: "L1",
  latestSubmissionId: "",
  submissionCount: 1,
  availability: { timeframes: [], days: [], duration: "" },
  notDuplicateOf: [],
  mergedFrom: [],
  createdAt: null,
  updatedAt: null,
  ...over,
});

const submission = (
  over: Partial<Omit<SurveySubmission, "answers">> & {
    id: string;
    answers?: Partial<SurveySubmission["answers"]>;
  }
): SurveySubmission => ({
  studentName: "Học viên",
  department: "Khoa Nội",
  email: "hv@bvhv.vn",
  phone: "0900000000",
  score: 50,
  assignedLevel: "L1",
  submittedAt: new Date("2026-08-05T10:00:00Z"),
  ...over,
  answers: {
    q1_tools: [],
    q2_paid: [],
    q3_frequency: "",
    q4_past_tasks: [],
    q5_concepts: [],
    q7_goals: [],
    q8_orientation: "",
    q9_repetitive_tasks: "",
    q10_timeframe: [],
    q11_days: [],
    q12_duration: "",
    ...over.answers,
  },
});

const enrollment = (over: Partial<Enrollment> & { classId: string; studentId: string }): Enrollment => ({
  level: "L1",
  status: "enrolled",
  matchScore: null,
  matchReason: null,
  enrolledAt: null,
  enrolledBy: "uid-giao-vu",
  ...over,
});

const classRecord = (over: Partial<ClassRecord> & { id: string }): ClassRecord => ({
  level: "L1",
  name: `Lớp ${over.id}`,
  instructor: "GV",
  room: "P1",
  capacity: 20,
  plannedSchedule: { days: [], timeframe: "", duration: "" },
  status: "active",
  enrolledCount: 0,
  ...over,
});

/** Đọc ô theo tên cột, để phép thử không phụ thuộc vào thứ tự cột. */
const cell = (
  out: { header: string[]; rows: (string | number)[][] },
  rowIndex: number,
  column: string
): string | number => {
  const col = out.header.indexOf(column);
  if (col === -1) throw new Error(`Không có cột "${column}" trong ${out.header.join(" | ")}`);
  return out.rows[rowIndex][col];
};

describe("buildStudentExport", () => {
  it("xuất mọi hồ sơ khi không lọc theo lớp", () => {
    const out = buildStudentExport({
      students: [
        student({ id: "an", fullName: "Nguyễn Văn An" }),
        student({ id: "binh", fullName: "Trần Thị Bình" }),
      ],
      submissions: [],
      enrollments: [],
      classes: [],
      classId: null,
    });

    expect(out.rows).toHaveLength(2);
    expect(cell(out, 0, "Họ tên")).toBe("Nguyễn Văn An");
    expect(cell(out, 1, "Họ tên")).toBe("Trần Thị Bình");
  });

  it("mỗi dòng có đủ số ô bằng số cột tiêu đề", () => {
    const out = buildStudentExport({
      students: [student({ id: "an" })],
      submissions: [],
      enrollments: [],
      classes: [],
      classId: null,
    });

    expect(out.rows[0]).toHaveLength(out.header.length);
  });

  it("chỉ lấy học viên ghi danh trong lớp được chọn", () => {
    const out = buildStudentExport({
      students: [
        student({ id: "an", fullName: "Nguyễn Văn An" }),
        student({ id: "binh", fullName: "Trần Thị Bình" }),
      ],
      submissions: [],
      enrollments: [enrollment({ classId: "c1", studentId: "an" })],
      classes: [classRecord({ id: "c1", name: "Lớp L1-K1" })],
      classId: "c1",
    });

    expect(out.rows).toHaveLength(1);
    expect(cell(out, 0, "Họ tên")).toBe("Nguyễn Văn An");
  });

  it("bỏ qua ghi danh đã chuyển lớp hoặc đã nghỉ", () => {
    const out = buildStudentExport({
      students: [student({ id: "an" }), student({ id: "binh" })],
      submissions: [],
      enrollments: [
        enrollment({ classId: "c1", studentId: "an", status: "transferred" }),
        enrollment({ classId: "c1", studentId: "binh", status: "dropped" }),
      ],
      classes: [classRecord({ id: "c1" })],
      classId: "c1",
    });

    expect(out.rows).toHaveLength(0);
  });

  it("đánh số thứ tự liên tục theo danh sách đã lọc", () => {
    const out = buildStudentExport({
      students: [student({ id: "an" }), student({ id: "binh" }), student({ id: "cuong" })],
      submissions: [],
      enrollments: [
        enrollment({ classId: "c1", studentId: "binh" }),
        enrollment({ classId: "c1", studentId: "cuong" }),
      ],
      classes: [classRecord({ id: "c1" })],
      classId: "c1",
    });

    expect(cell(out, 0, "STT")).toBe(1);
    expect(cell(out, 1, "STT")).toBe(2);
  });

  it("ghi tên lớp đang học, nối bằng dấu chấm phẩy khi học nhiều lớp", () => {
    const out = buildStudentExport({
      students: [student({ id: "an" })],
      submissions: [],
      enrollments: [
        enrollment({ classId: "c1", studentId: "an" }),
        enrollment({ classId: "c2", studentId: "an" }),
      ],
      classes: [
        classRecord({ id: "c1", name: "Lớp L1-K1" }),
        classRecord({ id: "c2", name: "Lớp L2-K1" }),
      ],
      classId: null,
    });

    expect(cell(out, 0, "Lớp đang học")).toBe("Lớp L1-K1; Lớp L2-K1");
  });

  it("để trống cột lớp khi học viên chưa được xếp lớp nào", () => {
    const out = buildStudentExport({
      students: [student({ id: "an" })],
      submissions: [],
      enrollments: [],
      classes: [],
      classId: null,
    });

    expect(cell(out, 0, "Lớp đang học")).toBe("");
  });

  it("lấy câu trả lời khảo sát từ phiếu mới nhất của hồ sơ", () => {
    const out = buildStudentExport({
      students: [student({ id: "an", latestSubmissionId: "sub-2" })],
      submissions: [
        submission({ id: "sub-1", answers: { q3_frequency: "Chưa bao giờ" } }),
        submission({ id: "sub-2", answers: { q3_frequency: "Hàng ngày" } }),
      ],
      enrollments: [],
      classes: [],
      classId: null,
    });

    expect(cell(out, 0, "3. Tần suất dùng AI cho công việc")).toBe("Hàng ngày");
  });

  it("nối đáp án nhiều lựa chọn bằng dấu phẩy", () => {
    const out = buildStudentExport({
      students: [student({ id: "an", latestSubmissionId: "sub-1" })],
      submissions: [
        submission({ id: "sub-1", answers: { q11_days: ["T2", "T4", "T6"] } }),
      ],
      enrollments: [],
      classes: [],
      classId: null,
    });

    expect(cell(out, 0, "11. Ngày trong tuần thuận tiện")).toBe("T2, T4, T6");
  });

  it("gộp ô Khác vào cột công cụ AI đã dùng", () => {
    const out = buildStudentExport({
      students: [student({ id: "an", latestSubmissionId: "sub-1" })],
      submissions: [
        submission({
          id: "sub-1",
          answers: { q1_tools: ["ChatGPT"], q1_tools_other: "Kimi" },
        }),
      ],
      enrollments: [],
      classes: [],
      classId: null,
    });

    expect(cell(out, 0, "1. Công cụ AI đã dùng")).toBe("ChatGPT, Kimi");
  });

  it("gộp ô Khác vào cột bản trả phí đang dùng", () => {
    const out = buildStudentExport({
      students: [student({ id: "an", latestSubmissionId: "sub-1" })],
      submissions: [
        submission({
          id: "sub-1",
          answers: { q2_paid: ["Gemini"], q2_paid_other: "Claude" },
        }),
      ],
      enrollments: [],
      classes: [],
      classId: null,
    });

    expect(cell(out, 0, "2. Bản trả phí đang dùng")).toBe("Gemini, Claude");
  });

  it("giữ điểm khảo sát là số để Excel còn tính được", () => {
    const out = buildStudentExport({
      students: [student({ id: "an", latestSubmissionId: "sub-1" })],
      submissions: [submission({ id: "sub-1", score: 72, assignedLevel: "L2" })],
      enrollments: [],
      classes: [],
      classId: null,
    });

    expect(cell(out, 0, "Điểm khảo sát")).toBe(72);
    expect(cell(out, 0, "Cấp độ đề xuất")).toBe("Cấp độ 2");
  });

  it("để trống các cột lấy từ phiếu khi hồ sơ chưa có phiếu khớp", () => {
    const out = buildStudentExport({
      students: [student({ id: "an", latestSubmissionId: "sub-da-xoa" })],
      submissions: [],
      enrollments: [],
      classes: [],
      classId: null,
    });

    expect(cell(out, 0, "Điểm khảo sát")).toBe("");
    expect(cell(out, 0, "Cấp độ đề xuất")).toBe("");
    expect(cell(out, 0, "Ngày nộp phiếu")).toBe("");
    expect(cell(out, 0, "3. Tần suất dùng AI cho công việc")).toBe("");
  });

  it("xuất thông tin định danh của hồ sơ", () => {
    const out = buildStudentExport({
      students: [
        student({
          id: "an",
          fullName: "Nguyễn Văn An",
          email: "an@bvhv.vn",
          phone: "0912345678",
          department: "Khoa Sản",
          currentLevel: "L3",
          submissionCount: 2,
        }),
      ],
      submissions: [],
      enrollments: [],
      classes: [],
      classId: null,
    });

    expect(cell(out, 0, "Họ tên")).toBe("Nguyễn Văn An");
    expect(cell(out, 0, "Email")).toBe("an@bvhv.vn");
    expect(cell(out, 0, "Điện thoại")).toBe("0912345678");
    expect(cell(out, 0, "Khoa / Phòng")).toBe("Khoa Sản");
    expect(cell(out, 0, "Cấp độ hiện tại")).toBe("Cấp độ 3");
    expect(cell(out, 0, "Số phiếu đã nộp")).toBe(2);
  });

  it("ghi ngày nộp phiếu theo định dạng Việt Nam", () => {
    const out = buildStudentExport({
      students: [student({ id: "an", latestSubmissionId: "sub-1" })],
      submissions: [
        submission({ id: "sub-1", submittedAt: new Date(2026, 7, 5, 10, 0) }),
      ],
      enrollments: [],
      classes: [],
      classId: null,
    });

    expect(cell(out, 0, "Ngày nộp phiếu")).toBe("05/08/2026");
  });
});

describe("STUDENT_EXPORT_WIDTHS", () => {
  it("khai độ rộng cho đúng mọi cột, thiếu một cột là lệch cả bảng", () => {
    expect(STUDENT_EXPORT_WIDTHS).toHaveLength(STUDENT_EXPORT_HEADER.length);
  });
});

describe("studentExportFileName", () => {
  it("bỏ dấu tiếng Việt để tên file không hỏng trên máy khác", () => {
    expect(studentExportFileName("Lớp Sáng Thứ Bảy", new Date(2026, 7, 14)))
      .toBe("hoc-vien-lop-sang-thu-bay-2026-08-14.xlsx");
  });

  it("gộp mọi ký tự lạ thành một gạch nối, không để gạch thừa ở hai đầu", () => {
    expect(studentExportFileName("  L1 — K1 (2026)  ", new Date(2026, 0, 9)))
      .toBe("hoc-vien-l1-k1-2026-2026-01-09.xlsx");
  });

  it("phạm vi rỗng thì file vẫn có tên đọc được", () => {
    expect(studentExportFileName("", new Date(2026, 11, 31)))
      .toBe("hoc-vien-2026-12-31.xlsx");
  });
});
