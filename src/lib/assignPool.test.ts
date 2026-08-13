import { describe, it, expect } from "vitest";
import { poolForLevel } from "./assignPool";
import { Student, ClassRecord, Enrollment } from "../types";

const student = (id: string, over: Partial<Student> = {}): Student => ({
  id, email: id, fullName: `Học viên ${id}`, department: "Khoa Nội",
  phone: "", currentLevel: "L1", latestSubmissionId: "", submissionCount: 1,
  availability: { timeframes: ["Tối"], days: ["T3", "T5"], duration: "90 phút" },
  notDuplicateOf: [], mergedFrom: [], createdAt: null, updatedAt: null,
  ...over,
} as Student);

const cls = (id: string, over: Partial<ClassRecord> = {}): ClassRecord => ({
  id, level: "L1", name: `Lớp ${id}`, instructor: "", room: "",
  capacity: 20, enrolledCount: 0, status: "active",
  plannedSchedule: { days: ["T3", "T5"], timeframe: "Tối", duration: "90 phút" },
  ...over,
} as ClassRecord);

const enr = (classId: string, studentId: string, over: Partial<Enrollment> = {}): Enrollment => ({
  id: `${classId}_${studentId}`, classId, studentId, level: "L1", status: "enrolled",
  matchScore: null, matchReason: null, enrolledAt: null, enrolledBy: "gv",
  ...over,
} as Enrollment);

const ids = (list: Student[]) => list.map(s => s.id);

describe("poolForLevel", () => {
  it("tab C1 gom cả người tham chiếu C2 và C3 — ai cũng phải học căn bản", () => {
    const students = [
      student("a", { currentLevel: "L1" }),
      student("b", { currentLevel: "L2" }),
      student("c", { currentLevel: "L3" }),
    ];
    expect(ids(poolForLevel(students, [], [], "L1"))).toEqual(["a", "b", "c"]);
  });

  it("tab C2 chỉ gom người tham chiếu C2 trở lên", () => {
    const students = [
      student("a", { currentLevel: "L1" }),
      student("b", { currentLevel: "L2" }),
      student("c", { currentLevel: "L3" }),
    ];
    expect(ids(poolForLevel(students, [], [], "L2"))).toEqual(["b", "c"]);
    expect(ids(poolForLevel(students, [], [], "L3"))).toEqual(["c"]);
  });

  it("đã ghi danh ở chính cấp này thì không hiện lại ở tab đó", () => {
    const students = [student("a", { currentLevel: "L3" })];
    const classes = [cls("c1", { level: "L1" })];
    const enrollments = [enr("c1", "a", { level: "L1" })];
    expect(ids(poolForLevel(students, enrollments, classes, "L1"))).toEqual([]);
  });

  it("đang học một lớp chưa đóng thì biến khỏi MỌI tab — mỗi lúc chỉ học một lớp", () => {
    const students = [student("a", { currentLevel: "L3" })];
    const classes = [cls("c1", { level: "L1", status: "active" })];
    const enrollments = [enr("c1", "a", { level: "L1" })];
    expect(ids(poolForLevel(students, enrollments, classes, "L2"))).toEqual([]);
    expect(ids(poolForLevel(students, enrollments, classes, "L3"))).toEqual([]);
  });

  it("lớp C1 đóng lại thì học viên C3 tự xuất hiện ở tab C2, nhưng không quay lại tab C1", () => {
    const students = [student("a", { currentLevel: "L3" })];
    const classes = [cls("c1", { level: "L1", status: "closed" })];
    const enrollments = [enr("c1", "a", { level: "L1" })];
    expect(ids(poolForLevel(students, enrollments, classes, "L2"))).toEqual(["a"]);
    expect(ids(poolForLevel(students, enrollments, classes, "L1"))).toEqual([]);
  });

  it("bỏ ghi danh (dropped/transferred) thì hiện lại như chưa từng xếp", () => {
    const students = [student("a", { currentLevel: "L1" })];
    const classes = [cls("c1", { level: "L1" })];
    const dropped = [enr("c1", "a", { level: "L1", status: "dropped" })];
    expect(ids(poolForLevel(students, dropped, classes, "L1"))).toEqual(["a"]);
  });

  it("ghi danh mồ côi (lớp đã bị xoá) không khoá học viên lại vĩnh viễn", () => {
    const students = [student("a", { currentLevel: "L3" })];
    const enrollments = [enr("mat-tich", "a", { level: "L1" })];
    // Vẫn tính là đã học C1 (level lưu ngay trong ghi danh), nhưng không chặn C2.
    expect(ids(poolForLevel(students, enrollments, [], "L1"))).toEqual([]);
    expect(ids(poolForLevel(students, enrollments, [], "L2"))).toEqual(["a"]);
  });

  it("giữ nguyên thứ tự danh sách học viên đưa vào", () => {
    const students = [student("z"), student("a"), student("m")];
    expect(ids(poolForLevel(students, [], [], "L1"))).toEqual(["z", "a", "m"]);
  });
});
