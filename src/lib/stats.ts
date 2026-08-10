import { SurveySubmission, PublicStatsData } from "../types";

/* Tính số liệu tổng hợp từ danh sách phiếu khảo sát.
   Hàm thuần, không chạm Firestore — vừa test được, vừa dùng chung cho
   cả bảng quản trị (tính tại chỗ) lẫn trang chủ (đọc bản đã ghi sẵn),
   nên hai nơi không bao giờ hiện lệch số. */
export function computePublicStats(submissions: SurveySubmission[]): PublicStatsData {
  const byLevel = { L1: 0, L2: 0, L3: 0 };
  const deptMap: Record<string, number> = {};

  for (const s of submissions) {
    if (s.assignedLevel in byLevel) {
      byLevel[s.assignedLevel]++;
    }
    // Phiếu cũ có thể thiếu khoa/phòng; gom hết về một nhóm thay vì tạo ô trống.
    const dept = (s.department || "").trim() || "Khác";
    deptMap[dept] = (deptMap[dept] || 0) + 1;
  }

  const topDepartments = Object.entries(deptMap)
    .map(([name, count]) => ({ name, count }))
    // Khi bằng điểm thì sắp theo tên, nếu không thứ tự sẽ nhảy mỗi lần tải lại.
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"))
    .slice(0, 5);

  return { totalStudents: submissions.length, byLevel, topDepartments };
}
