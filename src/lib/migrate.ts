import { fetchSubmissions } from "./repo/submissions";
import { upsertStudentDrafts } from "./repo/students";
import { buildStudentsFromSubmissions } from "./students";
import { SkippedSubmission } from "../types";

export interface MigrateReport {
  created: number;
  updated: number;
  skipped: SkippedSubmission[];
  totalSubmissions: number;
}

/* Dựng lại toàn bộ hồ sơ học viên từ phiếu khảo sát. Chạy được nhiều lần:
   Document ID là email nên lần sau chỉ cập nhật, không nhân đôi. Gọi tay từ
   màn Quản trị chứ KHÔNG tự chạy khi tải trang — tự chạy là kiểu lỗi đã gặp
   với seedInitialData trước đây (xem chú thích cũ ở src/lib/seed.ts). */
export async function migrateStudents(): Promise<MigrateReport> {
  const submissions = await fetchSubmissions();
  const { drafts, skipped } = buildStudentsFromSubmissions(submissions);
  const { created, updated } = await upsertStudentDrafts(drafts);
  return { created, updated, skipped, totalSubmissions: submissions.length };
}
