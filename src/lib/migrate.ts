import { fetchSubmissions } from "./repo/submissions";
import { upsertStudentDrafts } from "./repo/students";
import { migrateClasses } from "./repo/classes";
import { buildStudentsFromSubmissions } from "./students";
import { SkippedSubmission } from "../types";

export interface MigrateReport {
  created: number;
  updated: number;
  skipped: SkippedSubmission[];
  totalSubmissions: number;
  classesConverted: number;
  classesNeedReview: string[];
}

/* Dựng lại toàn bộ hồ sơ học viên từ phiếu khảo sát. Chạy được nhiều lần:
   Document ID là email nên lần sau chỉ cập nhật, không nhân đôi. Gọi tay từ
   màn Quản trị chứ KHÔNG tự chạy khi tải trang — tự chạy là kiểu lỗi đã gặp
   với hàm seed dữ liệu mẫu trước đây: nó chạy lại mỗi lần tải trang. */
export async function migrateStudents(): Promise<MigrateReport> {
  const submissions = await fetchSubmissions();
  const { drafts, skipped } = buildStudentsFromSubmissions(submissions);
  const { created, updated } = await upsertStudentDrafts(drafts);

  // Chuyển luôn lịch lớp sang dạng có cấu trúc: hai việc này đều là "dọn dữ
  // liệu cũ", bắt giáo vụ bấm hai nút riêng chỉ tạo thêm cơ hội quên một nút.
  const { converted, needsReview } = await migrateClasses();

  return {
    created, updated, skipped, totalSubmissions: submissions.length,
    classesConverted: converted, classesNeedReview: needsReview,
  };
}
