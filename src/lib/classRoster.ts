import { Enrollment, ClassRecord } from "../types";
import { normalizeEmail } from "./students";

/* Nối phiếu khảo sát với lớp học.
 *
 * Phiếu (survey_submissions) không mang classId — lúc học viên điền phiếu thì
 * chưa có lớp nào. Cầu nối là email: hồ sơ học viên lấy email đã chuẩn hóa làm
 * document ID, mà Enrollment.studentId chính là ID đó. Nên "phiếu này có thuộc
 * lớp kia không" quy về "email của phiếu có nằm trong danh sách ghi danh không". */

export interface ClassFilterOption {
  id: string;
  name: string;
  enrolledCount: number;
}

/** Tập email (đã chuẩn hóa) của những người ĐANG học lớp này.
 *  Người đã chuyển lớp hoặc đã nghỉ vẫn còn document ghi danh nhưng không
 *  thuộc lớp nữa, nên không được tính. */
export function rosterEmails(enrollments: Enrollment[], classId: string): Set<string> {
  const roster = new Set<string>();
  for (const e of enrollments) {
    if (e.classId === classId && e.status === "enrolled" && e.studentId) {
      roster.add(e.studentId);
    }
  }
  return roster;
}

/** Email trên phiếu có thuộc danh sách lớp không.
 *  Chuẩn hóa trước khi so vì học viên gõ email hoa thường tùy hứng, còn
 *  document ID thì luôn ở dạng thường. */
export function isInRoster(email: string, roster: Set<string>): boolean {
  const key = normalizeEmail(email);
  return key !== null && roster.has(key);
}

/** Các lớp hiện lên trong ô lọc, kèm sĩ số đang ghi danh.
 *  Lớp đã đóng bị loại: bộ lọc này phục vụ việc đang giảng dạy. */
export function classFilterOptions(
  classes: ClassRecord[],
  enrollments: Enrollment[]
): ClassFilterOption[] {
  /* Đếm một lượt cho mọi lớp thay vì quét lại danh sách ghi danh cho từng lớp.
     enrolledCount trên ClassRecord là số phi chuẩn hóa, có thể cũ. */
  const counts = new Map<string, number>();
  for (const e of enrollments) {
    if (e.status !== "enrolled") continue;
    counts.set(e.classId, (counts.get(e.classId) || 0) + 1);
  }

  return classes
    .filter(c => c.status !== "closed" && c.id)
    .map(c => ({
      id: c.id!,
      name: c.name,
      enrolledCount: counts.get(c.id!) || 0,
    }));
}
