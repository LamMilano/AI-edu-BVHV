import { describe, it, expect } from "vitest";
import { rosterEmails, isInRoster, classFilterOptions } from "./classRoster";
import { Enrollment, ClassRecord } from "../types";

const enrollment = (over: Partial<Enrollment> & { classId: string; studentId: string }): Enrollment => ({
  level: "L1",
  status: "enrolled",
  matchScore: null,
  matchReason: null,
  enrolledAt: null,
  enrolledBy: "uid-giao-vu",
  ...over,
});

const classRecord = (over: Partial<ClassRecord> & { id: string }): ClassRecord => ({
  level: "L1",
  name: `Lớp ${over.id}`,
  instructor: "GV",
  room: "P1",
  capacity: 20,
  plannedSchedule: { days: [], timeframe: "", duration: "" },
  status: "active",
  enrolledCount: 0,
  ...over,
});

describe("rosterEmails", () => {
  it("gom studentId của đúng lớp được hỏi", () => {
    const roster = rosterEmails(
      [
        enrollment({ classId: "c1", studentId: "an@bvhv.vn" }),
        enrollment({ classId: "c1", studentId: "binh@bvhv.vn" }),
        enrollment({ classId: "c2", studentId: "cuong@bvhv.vn" }),
      ],
      "c1"
    );
    expect(roster).toEqual(new Set(["an@bvhv.vn", "binh@bvhv.vn"]));
  });

  it("bỏ người đã chuyển lớp hoặc đã nghỉ", () => {
    const roster = rosterEmails(
      [
        enrollment({ classId: "c1", studentId: "an@bvhv.vn" }),
        enrollment({ classId: "c1", studentId: "binh@bvhv.vn", status: "transferred" }),
        enrollment({ classId: "c1", studentId: "cuong@bvhv.vn", status: "dropped" }),
      ],
      "c1"
    );
    expect(roster).toEqual(new Set(["an@bvhv.vn"]));
  });
});

describe("isInRoster", () => {
  const roster = new Set(["an@bvhv.vn"]);

  it("khớp phiếu với hồ sơ dù học viên gõ hoa hay thừa khoảng trắng", () => {
    expect(isInRoster("  An@BVHV.vn ", roster)).toBe(true);
  });

  it("phiếu của người ngoài lớp thì không khớp", () => {
    expect(isInRoster("binh@bvhv.vn", roster)).toBe(false);
  });

  /* Phiếu thiếu email không dựng được hồ sơ nên không thể thuộc lớp nào.
     Trả về false thay vì ném lỗi: mất một dòng còn hơn hỏng cả bảng. */
  it("phiếu thiếu email hợp lệ thì không thuộc lớp nào", () => {
    expect(isInRoster("", roster)).toBe(false);
    expect(isInRoster("khong-phai-email", roster)).toBe(false);
  });
});

describe("classFilterOptions", () => {
  it("kèm sĩ số thật để biết trước lớp có bao nhiêu người", () => {
    const options = classFilterOptions(
      [classRecord({ id: "c1", name: "L1-K1" }), classRecord({ id: "c2", name: "L2-K1" })],
      [
        enrollment({ classId: "c1", studentId: "an@bvhv.vn" }),
        enrollment({ classId: "c1", studentId: "binh@bvhv.vn", status: "dropped" }),
      ]
    );
    expect(options).toEqual([
      { id: "c1", name: "L1-K1", enrolledCount: 1 },
      { id: "c2", name: "L2-K1", enrolledCount: 0 },
    ]);
  });

  it("bỏ lớp đã đóng — không còn giảng dạy thì không cần lọc tới", () => {
    const options = classFilterOptions(
      [classRecord({ id: "c1" }), classRecord({ id: "c2", status: "closed" })],
      []
    );
    expect(options.map(o => o.id)).toEqual(["c1"]);
  });
});
