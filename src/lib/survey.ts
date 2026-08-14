import { SurveySubmission } from "../types";

/* Nhãn của từng câu hỏi khảo sát. Phiếu chi tiết trên màn hình và file Excel
   xuất ra đọc chung bảng này: hai nơi cùng gọi tên một câu hỏi thì giáo vụ
   đối chiếu được, còn mỗi nơi tự đặt tên thì sớm muộn cũng lệch nhau.
   Không có câu 6 — phiếu khảo sát nhảy từ câu 5 sang câu 7. */
export const SURVEY_LABELS = {
  q1_tools: "1. Công cụ AI đã dùng",
  q2_paid: "2. Bản trả phí đang dùng",
  q3_frequency: "3. Tần suất dùng AI cho công việc",
  q4_past_tasks: "4. Việc đã từng làm bằng AI",
  q5_concepts: "5. Khái niệm đã biết",
  q7_goals: "7. Mong muốn học nhất",
  q8_orientation: "8. Định hướng",
  q9_repetitive_tasks: "9. Công việc lặp lại muốn cải thiện bằng AI",
  q10_timeframe: "10. Khung giờ thuận tiện",
  q11_days: "11. Ngày trong tuần thuận tiện",
  q12_duration: "12. Thời lượng buổi phù hợp",
} as const;

/** Gộp đáp án nhiều lựa chọn (kèm ô "Khác") thành một dòng chữ. */
export const listAnswer = (items: string[] | undefined, fallback: string, other?: string) =>
  [...(items || []), other].filter(Boolean).join(", ") || fallback;

/* Câu trả lời của một phiếu, đã dàn phẳng thành chuỗi theo đúng thứ tự nhãn ở
   trên. Chỗ trống để rỗng chứ không điền "Chưa trả lời": trong bảng tính, ô
   rỗng lọc và đếm được, còn câu chữ thì không. */
export function flattenAnswers(sub: SurveySubmission | null): string[] {
  /* Phiếu cũ nhập tay có thể thiếu hẳn khối answers. Trả về dòng rỗng đúng
     độ dài thay vì ném lỗi — mất một dòng dữ liệu còn hơn hỏng cả file. */
  if (!sub || !sub.answers) return Object.keys(SURVEY_LABELS).map(() => "");
  const a = sub.answers;
  return [
    listAnswer(a.q1_tools, "", a.q1_tools_other),
    listAnswer(a.q2_paid, "", a.q2_paid_other),
    a.q3_frequency || "",
    listAnswer(a.q4_past_tasks, ""),
    listAnswer(a.q5_concepts, ""),
    listAnswer(a.q7_goals, ""),
    a.q8_orientation || "",
    a.q9_repetitive_tasks || "",
    listAnswer(a.q10_timeframe, ""),
    listAnswer(a.q11_days, ""),
    a.q12_duration || "",
  ];
}
