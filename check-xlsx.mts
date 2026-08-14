/* Kiểm chứng: dựng bảng bằng đúng logic sản phẩm rồi ghi ra .xlsx thật,
   dùng nhánh /node vì Node không có hộp thoại tải xuống. */
import writeXlsxFile from "write-excel-file/node";
import { buildStudentExport, STUDENT_EXPORT_WIDTHS, studentExportFileName } from "./src/lib/exportStudents";
import { toSheetData } from "./src/lib/xlsx";

const table = buildStudentExport({
  students: [
    {
      id: "an@bvhv.vn", email: "an@bvhv.vn", fullName: "Nguyễn Văn An",
      department: "Khoa Nội, Tổng hợp", phone: "0912345678", currentLevel: "L2",
      latestSubmissionId: "s1", submissionCount: 2,
      availability: { timeframes: ["Tối"], days: ["T2"], duration: "90 phút" },
      notDuplicateOf: [], mergedFrom: [], createdAt: null, updatedAt: null,
    },
    {
      id: "binh@bvhv.vn", email: "binh@bvhv.vn", fullName: "Trần Thị Bình",
      department: "Phòng Kế hoạch", phone: "0987654321", currentLevel: "L1",
      latestSubmissionId: "", submissionCount: 1,
      availability: { timeframes: [], days: [], duration: "" },
      notDuplicateOf: [], mergedFrom: [], createdAt: null, updatedAt: null,
    },
  ],
  submissions: [
    {
      id: "s1", studentName: "Nguyễn Văn An", department: "Khoa Nội, Tổng hợp",
      email: "an@bvhv.vn", phone: "0912345678", score: 72, assignedLevel: "L2",
      submittedAt: new Date(2026, 7, 5, 10, 0),
      answers: {
        q1_tools: ["ChatGPT", "Gemini"], q1_tools_other: "Kimi",
        q2_paid: [], q3_frequency: "Hàng tuần",
        q4_past_tasks: ["Soạn email", "Tóm tắt tài liệu"],
        q5_concepts: ["Prompt", "RAG"], q7_goals: ["Tự động hóa"],
        q8_orientation: "Ứng dụng vào chuyên môn",
        q9_repetitive_tasks: 'Nhập liệu báo cáo tuần, rất "thủ công"\nvà mất 3 tiếng.',
        q10_timeframe: ["Tối"], q11_days: ["T2", "T4"], q12_duration: "90 phút",
      },
    },
  ],
  enrollments: [
    { classId: "c1", studentId: "an@bvhv.vn", level: "L2", status: "enrolled", matchScore: null, matchReason: null, enrolledAt: null, enrolledBy: "u1" },
    { classId: "c2", studentId: "an@bvhv.vn", level: "L1", status: "dropped", matchScore: null, matchReason: null, enrolledAt: null, enrolledBy: "u1" },
  ],
  classes: [
    { id: "c1", level: "L2", name: "Lớp L2-K1 (Tối T2)", instructor: "GV", room: "P1", capacity: 20, plannedSchedule: { days: ["T2"], timeframe: "Tối", duration: "90 phút" }, status: "active", enrolledCount: 1 },
    { id: "c2", level: "L1", name: "Lớp L1-K1", instructor: "GV", room: "P2", capacity: 20, plannedSchedule: { days: [], timeframe: "", duration: "" }, status: "closed", enrolledCount: 0 },
  ],
  classId: null,
});

const out = "C:/Users/LAM-PC/AppData/Local/Temp/claude/e--OneDrive-VS-code-Antigravity-Antigravity-Web-AI-Edu/861a9614-3ea5-4248-b6fa-39540548b8d0/scratchpad/" + studentExportFileName("tat-ca", new Date(2026, 7, 14));

await writeXlsxFile(toSheetData(table.header, table.rows) as any, {
  sheet: "Danh sách học viên",
  columns: STUDENT_EXPORT_WIDTHS.map(width => ({ width })),
  stickyRowsCount: 1,
} as any).toFile(out);

console.log("Đã ghi:", out);
console.log("Số cột:", table.header.length, "| Số dòng:", table.rows.length);
console.log("Dòng 1:", JSON.stringify(table.rows[0]));
console.log("Dòng 2:", JSON.stringify(table.rows[1]));
