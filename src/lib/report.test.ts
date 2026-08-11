import { describe, it, expect } from "vitest";
import { buildClassReport, maxAbsentStreak } from "./report";
import { Session, Enrollment, Student, AttendanceStatus } from "../types";

const ses = (
  id: string, date: string, status: Session["status"],
  records: Record<string, AttendanceStatus>
): Session => ({
  id, classId: "c1", date, startTime: "18:00", durationMin: 120, topic: id,
  status, records, note: "", takenBy: null, takenAt: null, createdAt: null,
});

const enr = (studentId: string): Enrollment => ({
  id: `c1_${studentId}`, classId: "c1", studentId, level: "L1",
  status: "enrolled", matchScore: null, matchReason: null,
  enrolledAt: null, enrolledBy: "",
});

const stu = (id: string, fullName: string): Student => ({
  id, email: id, fullName, department: "Khoa Nội", phone: "",
  currentLevel: "L1", latestSubmissionId: "", submissionCount: 1,
  availability: { timeframes: [], days: [], duration: "" },
  notDuplicateOf: [], mergedFrom: [], createdAt: null, updatedAt: null,
});

const build = (sessions: Session[]) => buildClassReport({
  classId: "c1", sessions,
  enrollments: [enr("a@x.vn")],
  students: [stu("a@x.vn", "Nguyễn Văn A")],
});

describe("buildClassReport", () => {
  it("chỉ tính buổi đã điểm danh, bỏ buổi chưa diễn ra và buổi hoãn", () => {
    const r = build([
      ses("s1", "2026-08-01", "done", { "a@x.vn": "present" }),
      ses("s2", "2026-08-02", "cancelled", { "a@x.vn": "absent" }),
      ses("s3", "2026-08-03", "scheduled", {}),
    ]);
    expect(r.sessions.map(s => s.id)).toEqual(["s1"]);
    expect(r.rows[0].counted).toBe(1);
    expect(r.rows[0].rate).toBe(100);
  });

  it("sắp buổi theo ngày, không theo thứ tự đầu vào", () => {
    const r = build([
      ses("muon", "2026-08-09", "done", { "a@x.vn": "present" }),
      ses("som", "2026-08-01", "done", { "a@x.vn": "present" }),
    ]);
    expect(r.sessions.map(s => s.id)).toEqual(["som", "muon"]);
  });

  it("đi muộn vẫn tính là có tham gia", () => {
    const r = build([
      ses("s1", "2026-08-01", "done", { "a@x.vn": "late" }),
      ses("s2", "2026-08-02", "done", { "a@x.vn": "present" }),
    ]);
    expect(r.rows[0].attended).toBe(2);
    expect(r.rows[0].rate).toBe(100);
  });

  it("vắng có phép không vào tử số lẫn mẫu số", () => {
    const r = build([
      ses("s1", "2026-08-01", "done", { "a@x.vn": "present" }),
      ses("s2", "2026-08-02", "done", { "a@x.vn": "excused" }),
    ]);
    expect(r.rows[0].attended).toBe(1);
    expect(r.rows[0].counted).toBe(1);
    expect(r.rows[0].rate).toBe(100);
  });

  it("vắng không phép vào mẫu số nhưng không vào tử số", () => {
    const r = build([
      ses("s1", "2026-08-01", "done", { "a@x.vn": "present" }),
      ses("s2", "2026-08-02", "done", { "a@x.vn": "absent" }),
    ]);
    expect(r.rows[0].attended).toBe(1);
    expect(r.rows[0].counted).toBe(2);
    expect(r.rows[0].rate).toBe(50);
  });

  it("học viên ghi danh muộn có mẫu số nhỏ hơn, không bị tính vắng ngược", () => {
    const r = build([
      ses("s1", "2026-08-01", "done", {}),
      ses("s2", "2026-08-02", "done", { "a@x.vn": "present" }),
    ]);
    expect(r.rows[0].cells).toEqual([null, "present"]);
    expect(r.rows[0].counted).toBe(1);
    expect(r.rows[0].rate).toBe(100);
  });

  it("chưa có buổi nào tính được thì tỉ lệ bằng 0 chứ không chia cho 0", () => {
    const r = build([ses("s1", "2026-08-01", "scheduled", {})]);
    expect(r.rows[0].counted).toBe(0);
    expect(r.rows[0].rate).toBe(0);
  });

  it("làm tròn tỉ lệ đến số nguyên", () => {
    const r = build([
      ses("s1", "2026-08-01", "done", { "a@x.vn": "present" }),
      ses("s2", "2026-08-02", "done", { "a@x.vn": "present" }),
      ses("s3", "2026-08-03", "done", { "a@x.vn": "absent" }),
    ]);
    expect(r.rows[0].rate).toBe(67);
  });

  it("chỉ lấy học viên đang ghi danh lớp này", () => {
    const r = buildClassReport({
      classId: "c1",
      sessions: [ses("s1", "2026-08-01", "done", { "a@x.vn": "present" })],
      enrollments: [
        enr("a@x.vn"),
        { ...enr("cu@x.vn"), status: "dropped" },
        { ...enr("lop-khac@x.vn"), classId: "c2" },
      ],
      students: [stu("a@x.vn", "A"), stu("cu@x.vn", "Cũ"), stu("lop-khac@x.vn", "Khác")],
    });
    expect(r.rows.map(x => x.studentId)).toEqual(["a@x.vn"]);
  });

  it("bỏ qua buổi của lớp khác", () => {
    const r = build([
      ses("s1", "2026-08-01", "done", { "a@x.vn": "present" }),
      { ...ses("khac", "2026-08-02", "done", { "a@x.vn": "absent" }), classId: "c2" },
    ]);
    expect(r.sessions.map(s => s.id)).toEqual(["s1"]);
  });

  it("sắp học viên theo tên để bảng đọc được", () => {
    const r = buildClassReport({
      classId: "c1",
      sessions: [ses("s1", "2026-08-01", "done", {})],
      enrollments: [enr("b@x.vn"), enr("a@x.vn")],
      students: [stu("b@x.vn", "Trần Bình"), stu("a@x.vn", "Nguyễn An")],
    });
    expect(r.rows.map(x => x.fullName)).toEqual(["Nguyễn An", "Trần Bình"]);
  });
});

describe("maxAbsentStreak", () => {
  it("đếm chuỗi vắng liên tiếp dài nhất", () => {
    expect(maxAbsentStreak(["absent", "absent", "present", "absent"])).toBe(2);
  });

  it("có mặt làm đứt chuỗi", () => {
    expect(maxAbsentStreak(["absent", "present", "absent"])).toBe(1);
  });

  it("vắng có phép làm đứt chuỗi, vì đó không phải dấu hiệu bỏ học", () => {
    expect(maxAbsentStreak(["absent", "excused", "absent"])).toBe(1);
  });

  it("buổi chưa ghi danh bị bỏ qua, không làm đứt chuỗi", () => {
    expect(maxAbsentStreak(["absent", null, "absent"])).toBe(2);
  });

  it("không vắng buổi nào thì bằng 0", () => {
    expect(maxAbsentStreak(["present", "late"])).toBe(0);
  });

  it("danh sách rỗng bằng 0", () => {
    expect(maxAbsentStreak([])).toBe(0);
  });
});
