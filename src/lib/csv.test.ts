import { describe, it, expect } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("ghép tiêu đề và dòng, phân cách bằng dấu phẩy", () => {
    expect(toCsv(["Tên", "Điểm"], [["An", 10], ["Bình", 9]]))
      .toBe("Tên,Điểm\r\nAn,10\r\nBình,9");
  });

  it("bọc ô có dấu phẩy trong ngoặc kép, nếu không Excel tách nhầm cột", () => {
    expect(toCsv(["Khoa"], [["Nội, Tổng hợp"]]))
      .toBe('Khoa\r\n"Nội, Tổng hợp"');
  });

  it("nhân đôi dấu ngoặc kép bên trong ô", () => {
    expect(toCsv(["Ghi chú"], [['Lớp "đặc biệt"']]))
      .toBe('Ghi chú\r\n"Lớp ""đặc biệt"""');
  });

  it("bọc ô có xuống dòng", () => {
    expect(toCsv(["Ghi chú"], [["Dòng 1\nDòng 2"]]))
      .toBe('Ghi chú\r\n"Dòng 1\nDòng 2"');
  });

  it("không bọc số", () => {
    expect(toCsv(["Tỉ lệ"], [[85]])).toBe("Tỉ lệ\r\n85");
  });

  it("giữ nguyên dấu tiếng Việt", () => {
    expect(toCsv(["Họ tên"], [["Nguyễn Thị Hưởng"]]))
      .toBe("Họ tên\r\nNguyễn Thị Hưởng");
  });

  it("không có dòng nào thì chỉ còn tiêu đề", () => {
    expect(toCsv(["A", "B"], [])).toBe("A,B");
  });
});
