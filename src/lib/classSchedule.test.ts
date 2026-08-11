import { describe, it, expect } from "vitest";
import { parseLegacySchedule } from "./classSchedule";

describe("parseLegacySchedule", () => {
  it("đọc thứ, khung giờ và thời lượng từ dữ liệu seed cũ", () => {
    expect(parseLegacySchedule("Lớp L1-K1 (Sáng Thứ 7)", "08:30 - 10:30, Thứ 7 Hàng tuần"))
      .toEqual({ days: ["T7"], timeframe: "Sáng", duration: "120 phút" });
  });

  it("lấy khung giờ từ tên lớp khi chuỗi lịch chỉ có giờ", () => {
    expect(parseLegacySchedule("Lớp L1-K2 (Chiều Thứ 4)", "14:00 - 16:00, Thứ 4 Hàng tuần"))
      .toEqual({ days: ["T4"], timeframe: "Chiều", duration: "120 phút" });
  });

  it("giữ CN cho lớp Chủ Nhật, dù khảo sát không hỏi ngày này", () => {
    expect(parseLegacySchedule("Lớp L3-K1 (Sáng Chủ Nhật)", "09:00 - 11:00, Chủ Nhật Hàng tuần"))
      .toEqual({ days: ["CN"], timeframe: "Sáng", duration: "120 phút" });
  });

  it("đọc được nhiều thứ viết tắt và tính đúng 90 phút", () => {
    expect(parseLegacySchedule("", "18:00 - 19:30, T3, T5"))
      .toEqual({ days: ["T3", "T5"], timeframe: "Tối", duration: "90 phút" });
  });

  it("suy khung giờ từ giờ bắt đầu khi không có từ khóa nào", () => {
    expect(parseLegacySchedule("", "07:00 - 08:30, T2").timeframe).toBe("Sáng");
    expect(parseLegacySchedule("", "13:00 - 14:30, T2").timeframe).toBe("Chiều");
    expect(parseLegacySchedule("", "19:00 - 20:30, T2").timeframe).toBe("Tối");
  });

  it("thời lượng lạ thì để trống thay vì đoán bừa", () => {
    expect(parseLegacySchedule("", "08:00 - 09:45, T2").duration).toBe("");
  });

  it("chuỗi rỗng cho ra khung lịch rỗng, để giáo vụ biết cần khai lại", () => {
    expect(parseLegacySchedule("", "")).toEqual({ days: [], timeframe: "", duration: "" });
  });

  it("không trả về thứ trùng lặp", () => {
    expect(parseLegacySchedule("Thứ 3", "T3, Thứ 3").days).toEqual(["T3"]);
  });
});
