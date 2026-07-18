// Cổng phân quyền Giảng viên (client-side password gate).
//
// LƯU Ý BẢO MẬT: Đây là lớp "khóa nhẹ" để ngăn học viên vào trang Quản Trị.
// Mật khẩu được nhúng vào bundle phía client nên KHÔNG bảo mật tuyệt đối.
// Muốn bảo mật thật (mỗi GV một tài khoản, chặn ghi Firestore trái phép),
// hãy nâng cấp lên Firebase Authentication + Firestore Security Rules.

const STORAGE_KEY = "bvhv_teacher_auth";

// Mật khẩu lấy từ biến môi trường VITE_TEACHER_PASSWORD (file .env).
// Có giá trị dự phòng để app vẫn chạy khi chưa cấu hình .env.
const TEACHER_PASSWORD =
  (import.meta.env.VITE_TEACHER_PASSWORD as string | undefined)?.trim() ||
  "hungvuong2026";

/** Kiểm tra mật khẩu người dùng nhập. */
export function checkTeacherPassword(input: string): boolean {
  return input.trim() === TEACHER_PASSWORD;
}

/** Đã đăng nhập với quyền Giảng viên chưa (đọc từ localStorage). */
export function isTeacherAuthed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Ghi nhớ trạng thái đã đăng nhập. */
export function setTeacherAuthed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Bỏ qua nếu trình duyệt chặn localStorage.
  }
}

/** Đăng xuất: xóa trạng thái ghi nhớ. */
export function clearTeacherAuth(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Bỏ qua.
  }
}
