/* Danh mục Khoa / Phòng / Ban chuẩn của Bệnh viện Đa khoa Hùng Vương.
   Đây là nguồn duy nhất cho tên khoa phòng: form khảo sát chỉ nhận giá trị
   nằm trong danh sách này, nhờ đó dữ liệu thống kê không bị phân mảnh vì
   mỗi người gõ một kiểu ("Khoa Nhi", "khoa nhi", "Nhi khoa"…). */

export const DEPARTMENTS = [
  "Hồi Sức Cấp Cứu",
  "Nhi",
  "Phụ Sản",
  "Nội Tổng Hợp",
  "Ngoại Tổng Hợp",
  "Tim Mạch",
  "Chấn thương chỉnh hình - Ngoại thần kinh",
  "Trung tâm Tiêu hóa hô hấp",
  "Ung Bướu và Chăm sóc giảm nhẹ",
  "Da liễu - Thẩm mỹ",
  "YHCT - PHCN",
  "Liên Chuyên Khoa",
  "Khám Bệnh",
  "Trung tâm cấp cứu 115",
  "Điều Dưỡng",
  "Dinh Dưỡng",
  "Chẩn Đoán Hình Ảnh",
  "Xét Nghiệm",
  "Dược",
  "Kiểm soát nhiễm khuẩn và PC bệnh tật",
  "PKĐK Hùng Vương - Chân Mộng",
  "PKĐK Hùng Vương - Kim Xuyên",
  "PKĐK Hùng Vương - Thanh Ba",
  "PKĐK Hùng Vương - Sơn Dương",
  "HĐQT",
  "Ban giám đốc",
  "Ban Kiểm soát",
  "Phòng Kế hoạch Tổng Hợp",
  "Phòng Công Nghệ Thông Tin",
  "Tài chính",
  "Pháp chế",
  "Kinh Doanh",
  "Trung tâm mua sắm tập trung",
  "Siêu Thị Hùng Vương Mart",
  "Kỹ Thuật - Hạ Tầng",
  "Đội Lái Xe",
  "Đội An ninh - Phòng TCPC",
  "Hùng Vương Farm",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

/** Bỏ dấu, hạ chữ thường — để gõ "noi tong hop" vẫn ra "Nội Tổng Hợp".
    Chuyển đổi 1 ký tự → 1 ký tự nên vị trí khớp trên chuỗi đã chuẩn hoá
    dùng lại được nguyên vẹn cho chuỗi gốc khi tô đậm phần trùng. */
export function normalizeVi(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/** Chữ cái đầu mỗi từ: "Hồi Sức Cấp Cứu" → "hscc", để gõ tắt vẫn tìm được. */
function initialsOf(name: string): string {
  return normalizeVi(name)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(word => word[0])
    .join("");
}

const INDEX = DEPARTMENTS.map(name => ({
  name,
  norm: normalizeVi(name),
  initials: initialsOf(name),
}));

export interface DepartmentMatch {
  name: string;
  /** Vị trí đoạn trùng trên tên gốc, dùng để tô đậm. -1 nếu không trùng liền mạch. */
  hit: number;
  hitLength: number;
}

/** Lọc danh sách theo chuỗi người dùng gõ.
    Thứ tự ưu tiên: trùng từ đầu → trùng giữa chuỗi → đủ mọi từ khoá → gõ tắt. */
export function searchDepartments(query: string): DepartmentMatch[] {
  const q = normalizeVi(query).trim();
  if (!q) return DEPARTMENTS.map(name => ({ name, hit: -1, hitLength: 0 }));

  const tokens = q.split(/\s+/).filter(Boolean);

  const scored: Array<DepartmentMatch & { rank: number }> = [];

  INDEX.forEach(({ name, norm, initials }) => {
    const at = norm.indexOf(q);
    if (at === 0) {
      scored.push({ name, hit: 0, hitLength: q.length, rank: 0 });
      return;
    }
    if (at > 0) {
      scored.push({ name, hit: at, hitLength: q.length, rank: 1 });
      return;
    }
    if (tokens.length > 1 && tokens.every(t => norm.includes(t))) {
      const first = norm.indexOf(tokens[0]);
      scored.push({ name, hit: first, hitLength: tokens[0].length, rank: 2 });
      return;
    }
    if (initials.startsWith(q)) {
      scored.push({ name, hit: -1, hitLength: 0, rank: 3 });
    }
  });

  return scored
    .sort((a, b) => a.rank - b.rank)
    .map(({ name, hit, hitLength }) => ({ name, hit, hitLength }));
}

/** Trả về tên chuẩn nếu chuỗi nhập trùng một khoa/phòng (bỏ qua dấu, hoa thường). */
export function canonicalDepartment(value: string): string | null {
  const v = normalizeVi(value).trim().replace(/\s+/g, " ");
  if (!v) return null;
  const found = INDEX.find(d => d.norm.replace(/\s+/g, " ") === v);
  return found ? found.name : null;
}

export function isValidDepartment(value: string): boolean {
  return DEPARTMENTS.includes(value.trim() as Department);
}
