import { Student } from "../types";

/* Đề xuất chưa lưu: studentId → classId. Cùng dạng với state `drafts` của
   AssignmentBoard — hàm ở đây thuần túy, nhận vào một bản và trả về bản mới. */
export type DraftMap = Record<string, string>;

export interface BulkAddResult {
  drafts: DraftMap;
  added: number;     // số người thực sự được thêm vào lớp
  skipped: number;   // số người phải bỏ qua vì lớp hết chỗ
}

/**
 * Thêm một loạt học viên vào cùng một lớp, dừng lại khi hết chỗ.
 *
 * `remaining` là số chỗ trống của lớp đích tại thời điểm gọi — bên gọi phải
 * trừ sẵn cả những đề xuất chưa lưu đang trỏ vào lớp này, nếu không sẽ xếp
 * quá sức chứa trong cùng một lượt.
 */
export function addStudentsToClass(
  drafts: DraftMap,
  studentIds: string[],
  classId: string,
  remaining: number,
): BulkAddResult {
  const next = { ...drafts };
  let added = 0;
  let skipped = 0;
  let room = Math.max(0, remaining);

  for (const id of studentIds) {
    // Đã nháp sẵn vào chính lớp này: thao tác thừa, không ăn thêm chỗ.
    if (next[id] === classId) continue;

    if (room <= 0) { skipped++; continue; }

    next[id] = classId;
    added++;
    room--;
  }

  return { drafts: next, added, skipped };
}

/* Bỏ dấu để tìm kiếm. CỐ Ý khác normalizeName ở students.ts: ở đó giữ dấu vì
   bỏ dấu sẽ gộp nhầm hai người khác tên, còn ở đây chỉ là thu hẹp danh sách
   trước mắt giáo vụ — gõ "phu san" phải ra "Phụ Sản". */
function fold(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")   // xoá dấu thanh/dấu mũ đã tách ra khỏi nguyên âm
    .replace(/đ/g, "d")        // đ không tách được bằng NFD, phải thay tay
    .replace(/\s+/g, " ")
    .trim();
}

/** Lọc học viên theo tên hoặc khoa/phòng. Từ khoá rỗng giữ nguyên danh sách. */
export function filterStudents(students: Student[], query: string): Student[] {
  const q = fold(query);
  if (!q) return students;
  return students.filter(s => fold(s.fullName).includes(q) || fold(s.department).includes(q));
}
