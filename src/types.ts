export interface SurveySubmission {
  id?: string;
  studentName: string;
  department: string;
  email: string;
  phone: string;
  score: number;
  assignedLevel: "L1" | "L2" | "L3";
  answers: {
    // Q1-Q5: Part B (Placement & experience)
    q1_tools: string[]; // ['ChatGPT', 'Gemini', etc]
    q1_tools_other?: string; // free text when 'Khác' is picked
    q2_paid: string[]; // ['ChatGPT', 'Gemini', etc]
    q2_paid_other?: string; // free text when 'Khác' is picked
    q3_frequency: string; // 'Chưa bao giờ' | 'Thỉnh thoảng' | 'Hàng tuần' | 'Hàng ngày'
    q4_past_tasks: string[]; // list of past accomplishments
    q5_concepts: string[]; // list of known terms
    // Q7-Q9: Part C (Expectations)
    q7_goals: string[]; // desired levels
    q8_orientation: string; // learning path direction
    q9_repetitive_tasks: string; // description of manual tasks to automate
    // Q10-Q12: Part D (Logistics)
    q10_timeframe: string[]; // morning, afternoon, evening, etc.
    q11_days: string[]; // days of the week T2, T3...
    q12_duration: string; // '90 phút' | '120 phút'
  };
  submittedAt: any; // Firestore Timestamp
}

export interface Announcement {
  id?: string;
  title: string;
  content: string;
  category: "important" | "schedule" | "general";
  date: string;
  createdAt: any;
}

export interface ClassPlannedSchedule {
  days: string[];        // "T2".."T7" và "CN" (lớp có thể học Chủ Nhật, khảo sát thì không hỏi)
  timeframe: string;     // "Sáng" | "Chiều" | "Tối" | "" khi chưa xác định
  duration: string;      // "90 phút" | "120 phút" | "" khi chưa xác định
}

/* Một lớp học. plannedSchedule là KHUNG LỊCH DỰ KIẾN — chỉ dùng để so khớp
   với lịch rảnh của học viên và để hiển thị. Nó không sinh ra buổi học;
   buổi học được tạo thủ công ở GĐ4. */
export interface ClassRecord {
  id?: string;
  level: "L1" | "L2" | "L3";
  name: string;
  instructor: string;
  room: string;
  capacity: number;
  plannedSchedule: ClassPlannedSchedule;
  status: "planning" | "active" | "closed";   // bảng xếp lớp chỉ hiện planning và active
  /* Số phi chuẩn hóa. Nguồn sự thật là số document enrollments có
     status == "enrolled"; ghi danh xong thì đếm lại bằng recountClassEnrollments. */
  enrolledCount: number;
  createdAt?: any;
  updatedAt?: any;
}

export type AttendanceStatus = "present" | "late" | "excused" | "absent";

/* Một buổi học. records nhúng thẳng trong document buổi: cả lớp lưu được
   trong MỘT lượt ghi, nên không có trạng thái "lưu dở nửa lớp". Đánh đổi:
   báo cáo chuyên cần của một học viên phải đọc hết các buổi — chấp nhận
   được ở quy mô vài chục buổi mỗi lớp. */
export interface Session {
  id?: string;
  classId: string;
  date: string;          // "2026-08-20" — ISO nên sắp xếp được bằng chuỗi
  startTime: string;     // "18:00"
  durationMin: number;
  topic: string;
  status: "scheduled" | "done" | "cancelled";
  records: Record<string, AttendanceStatus>;   // studentId → trạng thái
  note: string;
  takenBy: string | null;   // uid người điểm danh
  takenAt: any;             // Firestore Timestamp | null
  createdAt: any;
}

export interface AttendanceSummary {
  present: number;
  late: number;
  excused: number;
  absent: number;
  total: number;
}

export type EnrollmentStatus = "enrolled" | "transferred" | "dropped";

/* Document ID = `${classId}_${studentId}`, nên ghi danh trùng là bất khả thi
   ở tầng lưu trữ chứ không chỉ ở tầng giao diện. */
export interface Enrollment {
  id?: string;
  classId: string;
  studentId: string;
  level: "L1" | "L2" | "L3";   // chép lại để lọc mà không phải join
  status: EnrollmentStatus;
  matchScore: number | null;    // null khi giáo vụ xếp tay
  matchReason: string | null;
  enrolledAt: any;
  enrolledBy: string;           // uid người thao tác
}

export interface StudentAvailability {
  timeframes: string[];   // từ q10_timeframe
  days: string[];         // từ q11_days
  duration: string;       // từ q12_duration
}

/* Hồ sơ học viên: BẢN CHIẾU của phiếu khảo sát, không phải bản gốc.
   survey_submissions vẫn là nguồn sự thật cho câu trả lời; hồ sơ chỉ giữ
   phần cần cho vận hành (xếp lớp, điểm danh). Document ID = email chuẩn hóa. */
export interface Student {
  id?: string;
  email: string;              // bản gốc như học viên gõ
  fullName: string;
  department: string;
  phone: string;
  currentLevel: "L1" | "L2" | "L3";
  latestSubmissionId: string;
  submissionCount: number;    // >1 nghĩa là đã làm lại khảo sát
  availability: StudentAvailability;
  notDuplicateOf: string[];   // id các hồ sơ đã xác nhận "không phải trùng"
  mergedFrom: string[];       // id các hồ sơ đã gộp vào đây
  createdAt: any;
  updatedAt: any;
}

/* Hồ sơ dựng từ phiếu, chưa có mốc thời gian của Firestore và chưa có
   những trường do giáo vụ quyết định. */
export type StudentDraft =
  Omit<Student, "createdAt" | "updatedAt" | "notDuplicateOf" | "mergedFrom"> & { id: string };

export interface SkippedSubmission {
  submissionId: string;
  studentName: string;
  reason: string;
}

export interface DuplicateGroup {
  key: string;
  fullName: string;
  department: string;
  students: Student[];   // luôn ≥ 2
}

/* Số liệu tổng hợp cho trang chủ. Khách vãng lai không có quyền đọc
   survey_submissions sau khi siết rules, nên trang chủ đọc document
   public_stats/summary thay vì tự đếm từ dữ liệu thô. */
export interface PublicStatsData {
  totalStudents: number;
  byLevel: { L1: number; L2: number; L3: number };
  topDepartments: { name: string; count: number }[];
}

/* Hình dạng thật của document public_stats/summary trên Firestore. */
export interface PublicStats extends PublicStatsData {
  updatedAt: any; // Firestore Timestamp
}

export type Role = "admin" | "teacher";

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
}
