import { describe, it, expect } from "vitest";
import { addStudentsToClass, filterStudents } from "./bulkAssign";
import { Student } from "../types";

const student = (over: Partial<Student> = {}): Student => ({
  id: "a@x.vn", email: "a@x.vn", fullName: "Nguyễn Văn A", department: "Khoa Nội",
  phone: "", currentLevel: "L1", latestSubmissionId: "", submissionCount: 1,
  availability: { timeframes: ["Tối"], days: ["T3", "T5"], duration: "90 phút" },
  notDuplicateOf: [], mergedFrom: [], createdAt: null, updatedAt: null,
  ...over,
} as Student);

describe("addStudentsToClass", () => {
  it("thêm cả nhóm vào lớp khi còn đủ chỗ", () => {
    const r = addStudentsToClass({}, ["s1", "s2", "s3"], "c1", 10);
    expect(r.drafts).toEqual({ s1: "c1", s2: "c1", s3: "c1" });
    expect(r.added).toBe(3);
    expect(r.skipped).toBe(0);
  });

  it("dừng đúng ở sức chứa, phần dư báo là bỏ qua", () => {
    const r = addStudentsToClass({}, ["s1", "s2", "s3"], "c1", 2);
    expect(r.drafts).toEqual({ s1: "c1", s2: "c1" });
    expect(r.added).toBe(2);
    expect(r.skipped).toBe(1);
  });

  it("không đụng tới đề xuất của lớp khác đã có sẵn", () => {
    const r = addStudentsToClass({ s9: "c2" }, ["s1"], "c1", 10);
    expect(r.drafts).toEqual({ s9: "c2", s1: "c1" });
  });

  /* Bấm trúng người đã nháp vào chính lớp này là thao tác thừa, không phải lỗi:
     không tính là thêm mới và tuyệt đối không được ăn thêm một chỗ. */
  it("người đã nháp sẵn vào chính lớp này thì không chiếm thêm chỗ", () => {
    const r = addStudentsToClass({ s1: "c1" }, ["s1", "s2"], "c1", 1);
    expect(r.drafts).toEqual({ s1: "c1", s2: "c1" });
    expect(r.added).toBe(1);
    expect(r.skipped).toBe(0);
  });

  it("chuyển người đang nháp ở lớp khác sang lớp này và ăn một chỗ", () => {
    const r = addStudentsToClass({ s1: "c2" }, ["s1", "s2"], "c1", 1);
    expect(r.drafts).toEqual({ s1: "c1" });
    expect(r.added).toBe(1);
    expect(r.skipped).toBe(1);
  });

  it("hết chỗ thì không thêm ai", () => {
    const r = addStudentsToClass({}, ["s1"], "c1", 0);
    expect(r.drafts).toEqual({});
    expect(r.added).toBe(0);
    expect(r.skipped).toBe(1);
  });

  it("không sửa đối tượng drafts được truyền vào", () => {
    const before = { s9: "c2" };
    addStudentsToClass(before, ["s1"], "c1", 10);
    expect(before).toEqual({ s9: "c2" });
  });
});

describe("filterStudents", () => {
  const list = [
    student({ id: "1", fullName: "Bùi Ngọc Hoan", department: "Phụ Sản" }),
    student({ id: "2", fullName: "Bùi Thanh Tùng", department: "Chẩn Đoán Hình Ảnh" }),
    student({ id: "3", fullName: "Cao Việt Tùng", department: "Ban Kiểm soát" }),
  ];

  it("từ khoá rỗng thì giữ nguyên danh sách", () => {
    expect(filterStudents(list, "   ")).toHaveLength(3);
  });

  it("lọc theo tên", () => {
    expect(filterStudents(list, "Tùng").map(s => s.id)).toEqual(["2", "3"]);
  });

  it("lọc theo khoa/phòng", () => {
    expect(filterStudents(list, "Phụ Sản").map(s => s.id)).toEqual(["1"]);
  });

  /* Giáo vụ gõ nhanh thường bỏ dấu. Khác với normalizeName ở students.ts —
     ở đó bỏ dấu sẽ gộp nhầm người, còn ở đây chỉ là thu hẹp danh sách. */
  it("gõ không dấu vẫn tìm ra", () => {
    expect(filterStudents(list, "phu san").map(s => s.id)).toEqual(["1"]);
    expect(filterStudents(list, "chan doan").map(s => s.id)).toEqual(["2"]);
  });

  it("không phân biệt hoa thường và bỏ khoảng trắng thừa", () => {
    expect(filterStudents(list, "  bùi  ").map(s => s.id)).toEqual(["1", "2"]);
  });

  it("chữ đ được coi như d", () => {
    expect(filterStudents(list, "chan doan hinh anh").map(s => s.id)).toEqual(["2"]);
  });
});
