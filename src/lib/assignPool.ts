import { Student, ClassRecord, Enrollment } from "../types";
import { canStudy, LevelId } from "./levels";

/**
 * Những học viên còn phải xếp vào một lớp cấp `level`.
 *
 * Ba điều kiện, tất cả đều phải đúng:
 *
 * 1. Cấp của tab không cao hơn cấp tham chiếu từ khảo sát — C3 hiện ở cả ba
 *    tab, C1 chỉ hiện ở tab C1.
 * 2. Chưa từng ghi danh ở CHÍNH cấp này. Tính cả ghi danh ở lớp đã đóng: học
 *    xong rồi thì đừng bày ra để xếp lại.
 * 3. Không đang ghi danh ở lớp nào chưa đóng, bất kể cấp nào — mỗi lúc một
 *    lớp. Lớp đóng lại là học viên tự xuất hiện ở tab cấp kế tiếp, giáo vụ
 *    không phải thao tác gì thêm.
 *
 * Thứ tự danh sách vào sao thì ra vậy; việc sắp xếp thuộc về bên gọi.
 */
export function poolForLevel(
  students: Student[],
  enrollments: Enrollment[],
  classes: ClassRecord[],
  level: LevelId,
): Student[] {
  const statusOf = new Map(classes.map(c => [c.id || "", c.status]));

  const enrolledLevels = new Map<string, Set<string>>();   // studentId → các cấp đã ghi danh
  const busy = new Set<string>();                          // studentId đang học lớp chưa đóng

  for (const e of enrollments) {
    if (e.status !== "enrolled") continue;   // dropped/transferred coi như chưa từng xếp

    const levels = enrolledLevels.get(e.studentId) || new Set<string>();
    levels.add(e.level);
    enrolledLevels.set(e.studentId, levels);

    /* Ghi danh mồ côi (lớp đã bị xoá) thì statusOf không có gì — không được
       khoá học viên lại vĩnh viễn: không còn lớp thì không còn bận. */
    const status = statusOf.get(e.classId);
    if (status && status !== "closed") busy.add(e.studentId);
  }

  return students.filter(s => {
    const id = s.id || "";
    if (!canStudy(s.currentLevel, level)) return false;
    if (enrolledLevels.get(id)?.has(level)) return false;
    if (busy.has(id)) return false;
    return true;
  });
}
