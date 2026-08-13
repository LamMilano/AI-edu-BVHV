import { describe, it, expect } from "vitest";
import { scoreClassForStudent, rankClassesForStudent } from "./matching";
import { Student, ClassRecord } from "../types";

const student = (over: Partial<Student> = {}): Student => ({
  id: "a@x.vn", email: "a@x.vn", fullName: "Nguyễn Văn A", department: "Khoa Nội",
  phone: "", currentLevel: "L1", latestSubmissionId: "", submissionCount: 1,
  availability: { timeframes: ["Tối"], days: ["T3", "T5"], duration: "90 phút" },
  notDuplicateOf: [], mergedFrom: [], createdAt: null, updatedAt: null,
  ...over,
} as Student);

const cls = (over: Partial<ClassRecord> = {}): ClassRecord => ({
  id: "c1", level: "L1", name: "Lớp A", instructor: "", room: "",
  capacity: 20, enrolledCount: 0, status: "active",
  plannedSchedule: { days: ["T3", "T5"], timeframe: "Tối", duration: "90 phút" },
  ...over,
} as ClassRecord);

describe("scoreClassForStudent", () => {
  it("khớp hoàn toàn được 100 điểm", () => {
    const r = scoreClassForStudent(student(), cls());
    expect(r.eligible).toBe(true);
    expect(r.score).toBe(100);
  });

  it("lớp cao hơn cấp tham chiếu thì loại thẳng, không chấm điểm", () => {
    const r = scoreClassForStudent(student({ currentLevel: "L1" }), cls({ level: "L3" }));
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe("Cao hơn cấp tham chiếu");
  });

  it("học viên C3 vẫn học được lớp C1 — cấp khảo sát chỉ là đích lộ trình", () => {
    const r = scoreClassForStudent(student({ currentLevel: "L3" }), cls({ level: "L1" }));
    expect(r.eligible).toBe(true);
    expect(r.score).toBe(100);
  });

  it("lớp đã đầy thì loại thẳng", () => {
    const r = scoreClassForStudent(student(), cls({ capacity: 10, enrolledCount: 10 }));
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe("Lớp đã đầy");
  });

  it("lớp đã đóng thì loại thẳng", () => {
    const r = scoreClassForStudent(student(), cls({ status: "closed" }));
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe("Lớp đã đóng");
  });

  it("khớp một nửa số ngày thì mất một nửa điểm ngày", () => {
    // Học viên rảnh T3 và T5; lớp chỉ học T3 → 25 + 35 + 15 = 75
    const r = scoreClassForStudent(
      student(),
      cls({ plannedSchedule: { days: ["T3"], timeframe: "Tối", duration: "90 phút" } })
    );
    expect(r.score).toBe(75);
  });

  it("lệch khung giờ thì mất 35 điểm", () => {
    const r = scoreClassForStudent(
      student(),
      cls({ plannedSchedule: { days: ["T3", "T5"], timeframe: "Sáng", duration: "90 phút" } })
    );
    expect(r.score).toBe(65);
  });

  it("lệch thời lượng thì mất 15 điểm", () => {
    const r = scoreClassForStudent(
      student(),
      cls({ plannedSchedule: { days: ["T3", "T5"], timeframe: "Tối", duration: "120 phút" } })
    );
    expect(r.score).toBe(85);
  });

  it("học viên chưa có dữ liệu lịch rảnh vẫn xếp được nhưng 0 điểm và nói rõ lý do", () => {
    const r = scoreClassForStudent(
      student({ availability: { timeframes: [], days: [], duration: "" } }),
      cls()
    );
    expect(r.eligible).toBe(true);
    expect(r.score).toBe(0);
    expect(r.reason).toBe("Chưa có dữ liệu lịch rảnh");
  });

  it("trừ 10 điểm khi lớp còn dưới 20% chỗ, để rải học viên đều giữa các lớp", () => {
    const r = scoreClassForStudent(student(), cls({ capacity: 20, enrolledCount: 17 }));
    expect(r.score).toBe(90);
  });

  it("điểm không bao giờ âm", () => {
    const r = scoreClassForStudent(
      student({ availability: { timeframes: ["Sáng"], days: ["T2"], duration: "120 phút" } }),
      cls({ capacity: 20, enrolledCount: 19 })
    );
    expect(r.score).toBe(0);
  });

  it("lý do đọc được, nêu ngày trùng, khung giờ và số chỗ còn lại", () => {
    const r = scoreClassForStudent(student(), cls({ capacity: 20, enrolledCount: 14 }));
    expect(r.reason).toBe("Khớp T3, T5 · buổi Tối · lớp còn 6 chỗ");
  });

  it("nói rõ khi không trùng ngày nào", () => {
    const r = scoreClassForStudent(
      student(),
      cls({ plannedSchedule: { days: ["CN"], timeframe: "Tối", duration: "90 phút" } })
    );
    expect(r.reason).toContain("Không trùng ngày");
  });
});

describe("rankClassesForStudent", () => {
  it("chỉ trả lớp hợp lệ, sắp theo điểm giảm dần", () => {
    const results = rankClassesForStudent(student(), [
      cls({ id: "kem", plannedSchedule: { days: ["T2"], timeframe: "Sáng", duration: "120 phút" } }),
      cls({ id: "tot" }),
      cls({ id: "khac-cap", level: "L3" }),
    ]);
    expect(results.map(r => r.classId)).toEqual(["tot", "kem"]);
  });

  it("trả mảng rỗng khi không có lớp nào hợp lệ", () => {
    expect(rankClassesForStudent(student(), [cls({ level: "L2" })])).toEqual([]);
  });
});
