import { describe, it, expect } from "vitest";
import { buildAttendanceRecords, summarizeAttendance } from "./attendance";

describe("buildAttendanceRecords", () => {
  it("mặc định cả lớp có mặt, vì vắng mới là ngoại lệ", () => {
    expect(buildAttendanceRecords(["a@x.vn", "b@x.vn"])).toEqual({
      "a@x.vn": "present",
      "b@x.vn": "present",
    });
  });

  it("giữ nguyên trạng thái đã điểm danh trước đó", () => {
    expect(buildAttendanceRecords(["a@x.vn", "b@x.vn"], { "a@x.vn": "absent" })).toEqual({
      "a@x.vn": "absent",
      "b@x.vn": "present",
    });
  });

  it("học viên ghi danh sau buổi đó được thêm vào với trạng thái có mặt", () => {
    const r = buildAttendanceRecords(["a@x.vn", "moi@x.vn"], { "a@x.vn": "late" });
    expect(r["moi@x.vn"]).toBe("present");
  });

  it("bỏ khỏi bảng người không còn ghi danh, để không đếm nhầm mẫu số", () => {
    const r = buildAttendanceRecords(["a@x.vn"], { "a@x.vn": "present", "da-nghi@x.vn": "absent" });
    expect(r).toEqual({ "a@x.vn": "present" });
  });

  it("lớp chưa có ai thì bảng rỗng", () => {
    expect(buildAttendanceRecords([])).toEqual({});
  });

  it("trạng thái lạ trong dữ liệu cũ bị thay bằng có mặt thay vì giữ nguyên", () => {
    const r = buildAttendanceRecords(["a@x.vn"], { "a@x.vn": "khong-biet" as any });
    expect(r["a@x.vn"]).toBe("present");
  });
});

describe("summarizeAttendance", () => {
  it("đếm đúng từng trạng thái và tổng", () => {
    expect(summarizeAttendance({
      a: "present", b: "present", c: "late", d: "excused", e: "absent",
    })).toEqual({ present: 2, late: 1, excused: 1, absent: 1, total: 5 });
  });

  it("bảng rỗng cho ra toàn số 0", () => {
    expect(summarizeAttendance({}))
      .toEqual({ present: 0, late: 0, excused: 0, absent: 0, total: 0 });
  });
});
