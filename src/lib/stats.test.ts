import { describe, it, expect } from "vitest";
import { computePublicStats } from "./stats";
import { SurveySubmission } from "../types";

// Chỉ dựng những trường mà computePublicStats thực sự đọc.
const sub = (level: string, department: string): SurveySubmission =>
  ({ assignedLevel: level, department } as unknown as SurveySubmission);

describe("computePublicStats", () => {
  it("trả về số 0 cho danh sách rỗng", () => {
    expect(computePublicStats([])).toEqual({
      totalStudents: 0,
      byLevel: { L1: 0, L2: 0, L3: 0 },
      topDepartments: [],
    });
  });

  it("đếm đúng số học viên theo từng cấp độ", () => {
    const result = computePublicStats([
      sub("L1", "Nội"), sub("L1", "Nội"), sub("L2", "Ngoại"), sub("L3", "Dược"),
    ]);
    expect(result.totalStudents).toBe(4);
    expect(result.byLevel).toEqual({ L1: 2, L2: 1, L3: 1 });
  });

  it("bỏ qua cấp độ lạ nhưng vẫn tính vào tổng", () => {
    const result = computePublicStats([sub("L9", "Nội"), sub("L1", "Nội")]);
    expect(result.totalStudents).toBe(2);
    expect(result.byLevel).toEqual({ L1: 1, L2: 0, L3: 0 });
  });

  it("gộp khoa/phòng rỗng hoặc toàn khoảng trắng vào 'Khác'", () => {
    const result = computePublicStats([sub("L1", ""), sub("L1", "   "), sub("L1", "Nội")]);
    expect(result.topDepartments).toEqual([
      { name: "Khác", count: 2 },
      { name: "Nội", count: 1 },
    ]);
  });

  it("chỉ giữ 5 khoa/phòng đông nhất, sắp giảm dần", () => {
    const subs = [
      ...Array(6).fill(0).map(() => sub("L1", "A")),
      ...Array(5).fill(0).map(() => sub("L1", "B")),
      ...Array(4).fill(0).map(() => sub("L1", "C")),
      ...Array(3).fill(0).map(() => sub("L1", "D")),
      ...Array(2).fill(0).map(() => sub("L1", "E")),
      sub("L1", "F"),
    ];
    const result = computePublicStats(subs);
    expect(result.topDepartments.map(d => d.name)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("hai khoa bằng điểm thì sắp theo tên, để kết quả ổn định giữa các lần chạy", () => {
    const result = computePublicStats([sub("L1", "Ngoại"), sub("L1", "Dược")]);
    expect(result.topDepartments.map(d => d.name)).toEqual(["Dược", "Ngoại"]);
  });
});
