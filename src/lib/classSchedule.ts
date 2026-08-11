import { ClassPlannedSchedule } from "../types";

/* Giá trị phải khớp đúng lựa chọn trong khảo sát (SurveyForm.tsx:244-245),
   nếu không thì phép so khớp ở matching.ts sẽ không bao giờ trùng.
   CN chỉ có ở phía lớp: khảo sát không hỏi Chủ Nhật. */
export const DAY_OPTIONS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
export const TIMEFRAME_OPTIONS = ["Sáng", "Chiều", "Tối"];
export const DURATION_OPTIONS = ["90 phút", "120 phút"];

/* Dò bằng regex có ranh giới rõ ràng thay vì includes(): chuỗi "T3" nằm lọt
   trong "LT35" sẽ bị nhận nhầm nếu chỉ so chuỗi con. */
const DAY_PATTERNS: { day: string; re: RegExp }[] = [
  { day: "T2", re: /(thứ\s*2|thứ\s*hai|\bt2\b)/i },
  { day: "T3", re: /(thứ\s*3|thứ\s*ba|\bt3\b)/i },
  { day: "T4", re: /(thứ\s*4|thứ\s*tư|\bt4\b)/i },
  { day: "T5", re: /(thứ\s*5|thứ\s*năm|\bt5\b)/i },
  { day: "T6", re: /(thứ\s*6|thứ\s*sáu|\bt6\b)/i },
  { day: "T7", re: /(thứ\s*7|thứ\s*bảy|\bt7\b)/i },
  { day: "CN", re: /(chủ\s*nhật|\bcn\b)/i },
];

/* Suy khung giờ từ giờ bắt đầu khi không có từ khóa. Mốc 12h và 17h theo
   thói quen gọi buổi ở bệnh viện, không phải chuẩn nào cả. */
function timeframeFromHour(hour: number): string {
  if (hour < 12) return "Sáng";
  if (hour < 17) return "Chiều";
  return "Tối";
}

/* Đọc khung lịch từ dữ liệu cũ dạng chữ tự do. Quét CẢ tên lớp lẫn chuỗi
   lịch: dữ liệu seed để "Sáng"/"Chiều" trong tên lớp còn chuỗi lịch chỉ có
   giờ, nên chỉ quét một trong hai là hụt. */
export function parseLegacySchedule(name: string, schedule: string): ClassPlannedSchedule {
  const text = `${name || ""} ${schedule || ""}`;

  const days = DAY_PATTERNS.filter(p => p.re.test(text)).map(p => p.day);

  let timeframe = TIMEFRAME_OPTIONS.find(t => new RegExp(t, "i").test(text)) || "";

  // Bắt cặp "HH:MM - HH:MM" để suy khung giờ và tính thời lượng.
  const span = /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/.exec(text);
  let duration = "";
  if (span) {
    const startMin = Number(span[1]) * 60 + Number(span[2]);
    const endMin = Number(span[3]) * 60 + Number(span[4]);
    const minutes = endMin - startMin;
    if (minutes === 90) duration = "90 phút";
    else if (minutes === 120) duration = "120 phút";
    // Thời lượng lạ thì để trống: đoán bừa sẽ làm điểm khớp sai mà không ai biết.

    if (!timeframe) timeframe = timeframeFromHour(Number(span[1]));
  }

  return { days, timeframe, duration };
}
