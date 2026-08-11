import { AttendanceStatus, AttendanceSummary } from "../types";

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Có mặt",
  late: "Muộn",
  excused: "Vắng có phép",
  absent: "Vắng",
};

/* Thứ tự này quyết định thứ tự nút trên màn điểm danh: trạng thái hay dùng
   nhất đứng trước, để giảng viên chạm ít nhất khi đang đứng lớp. */
export const ATTENDANCE_ORDER: AttendanceStatus[] = ["present", "late", "excused", "absent"];

const isValidStatus = (v: unknown): v is AttendanceStatus =>
  typeof v === "string" && (ATTENDANCE_ORDER as string[]).includes(v);

/* Dựng bảng điểm danh cho một buổi.

   Mặc định CẢ LỚP có mặt: vắng mới là ngoại lệ, nên giảng viên chỉ phải
   chạm vào vài người thay vì cả ba mươi.

   Bảng chỉ chứa người ĐANG ghi danh. Người ghi danh muộn được thêm vào với
   trạng thái có mặt chứ không bị tính vắng ngược; người đã nghỉ bị loại khỏi
   bảng để không làm phồng mẫu số của báo cáo chuyên cần. */
export function buildAttendanceRecords(
  enrolledIds: string[],
  existing?: Record<string, AttendanceStatus>
): Record<string, AttendanceStatus> {
  const out: Record<string, AttendanceStatus> = {};
  for (const id of enrolledIds) {
    const prev = existing?.[id];
    out[id] = isValidStatus(prev) ? prev : "present";
  }
  return out;
}

export function summarizeAttendance(
  records: Record<string, AttendanceStatus>
): AttendanceSummary {
  const out: AttendanceSummary = { present: 0, late: 0, excused: 0, absent: 0, total: 0 };
  for (const status of Object.values(records || {})) {
    if (!isValidStatus(status)) continue;
    out[status]++;
    out.total++;
  }
  return out;
}
