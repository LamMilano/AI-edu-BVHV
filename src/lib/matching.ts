import { Student, ClassRecord } from "../types";
import { canStudy } from "./levels";

export interface MatchResult {
  classId: string;
  score: number;      // 0..100
  reason: string;
  eligible: boolean;
}

/* Trọng số: ngày quan trọng nhất vì lệch ngày là học viên không đi được;
   khung giờ quan trọng vừa; thời lượng chỉ là ưu tiên nhẹ. Tổng đúng 100
   để con số hiển thị đọc được như phần trăm. */
const W_DAYS = 50;
const W_TIMEFRAME = 35;
const W_DURATION = 15;

/* Lớp còn dưới 20% chỗ bị trừ điểm, để hệ thống rải học viên sang lớp khác
   thay vì dồn hết vào lớp khớp nhất rồi tràn. */
const NEARLY_FULL_RATIO = 0.2;
const NEARLY_FULL_PENALTY = 10;

const ineligible = (classId: string, reason: string): MatchResult =>
  ({ classId, score: 0, reason, eligible: false });

export function scoreClassForStudent(student: Student, cls: ClassRecord): MatchResult {
  const classId = cls.id || "";

  /* Chỉ chặn chiều đi lên: lớp cao hơn cấp tham chiếu thì học viên chưa với
     tới. Chiều đi xuống luôn hợp lệ vì C2/C3 đều phải học lại nền C1. */
  if (!canStudy(student.currentLevel, cls.level)) {
    return ineligible(classId, "Cao hơn cấp tham chiếu");
  }
  if (cls.status === "closed") return ineligible(classId, "Lớp đã đóng");

  const capacity = cls.capacity || 0;
  const enrolled = cls.enrolledCount || 0;
  const remaining = capacity - enrolled;
  if (capacity > 0 && remaining <= 0) return ineligible(classId, "Lớp đã đầy");

  const avail = student.availability || { timeframes: [], days: [], duration: "" };
  const studentDays = avail.days || [];
  const studentTimeframes = avail.timeframes || [];

  /* Phiếu cũ có thể trống cả ba câu về lịch. Vẫn cho xếp — giáo vụ có thể
     biết lịch của người này qua kênh khác — nhưng chấm 0 để họ xuống cuối
     danh sách đề xuất thay vì lẫn vào những ca thật sự khớp. */
  if (studentDays.length === 0 && studentTimeframes.length === 0) {
    return { classId, score: 0, reason: "Chưa có dữ liệu lịch rảnh", eligible: true };
  }

  const classDays = cls.plannedSchedule?.days || [];
  const overlapDays = classDays.filter(d => studentDays.includes(d));
  const dayScore = studentDays.length > 0
    ? W_DAYS * (overlapDays.length / studentDays.length)
    : 0;

  const classTimeframe = cls.plannedSchedule?.timeframe || "";
  const timeframeMatched = !!classTimeframe && studentTimeframes.includes(classTimeframe);
  const timeframeScore = timeframeMatched ? W_TIMEFRAME : 0;

  const classDuration = cls.plannedSchedule?.duration || "";
  const durationMatched = !!classDuration && classDuration === avail.duration;
  const durationScore = durationMatched ? W_DURATION : 0;

  const penalty = capacity > 0 && remaining / capacity < NEARLY_FULL_RATIO
    ? NEARLY_FULL_PENALTY
    : 0;

  const score = Math.max(0, Math.min(100,
    Math.round(dayScore + timeframeScore + durationScore - penalty)
  ));

  /* Lý do phải đọc được thành câu, vì nó được lưu vào enrollments.matchReason —
     sáu tháng sau vẫn phải truy được vì sao học viên này vào lớp này. */
  const parts = [
    overlapDays.length > 0 ? `Khớp ${overlapDays.join(", ")}` : "Không trùng ngày",
    timeframeMatched ? `buổi ${classTimeframe}` : `lệch buổi${classTimeframe ? ` (${classTimeframe})` : ""}`,
    capacity > 0 ? `lớp còn ${remaining} chỗ` : "lớp chưa đặt sức chứa",
  ];

  return { classId, score, reason: parts.join(" · "), eligible: true };
}

export function rankClassesForStudent(student: Student, classes: ClassRecord[]): MatchResult[] {
  return classes
    .map(c => scoreClassForStudent(student, c))
    .filter(r => r.eligible)
    .sort((a, b) => b.score - a.score);
}
