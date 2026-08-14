import { describe, it, expect } from "vitest";
import { toSheetData } from "./xlsx";

describe("toSheetData", () => {
  it("đặt tiêu đề ở dòng đầu và in đậm", () => {
    const [head] = toSheetData(["STT", "Họ tên"], []);
    expect(head.map(c => c!.value)).toEqual(["STT", "Họ tên"]);
    expect(head.every(c => c!.fontWeight === "bold")).toBe(true);
  });

  it("giữ ô số là kiểu số để Excel còn tính được", () => {
    const [, row] = toSheetData(["Điểm"], [[72]]);
    expect(row[0]).toMatchObject({ type: Number, value: 72 });
  });

  it("giữ ô chữ là kiểu chuỗi", () => {
    const [, row] = toSheetData(["Họ tên"], [["Nguyễn Văn An"]]);
    expect(row[0]).toMatchObject({ type: String, value: "Nguyễn Văn An" });
  });

  it("biến ô rỗng thành ô trống thật, không phải chuỗi rỗng", () => {
    const [, row] = toSheetData(["Ghi chú"], [[""]]);
    expect(row[0]).toBeNull();
  });

  it("số 0 vẫn là số chứ không bị coi là ô rỗng", () => {
    const [, row] = toSheetData(["Số phiếu"], [[0]]);
    expect(row[0]).toMatchObject({ type: Number, value: 0 });
  });

  it("sinh đúng một dòng cho mỗi dòng dữ liệu, cộng dòng tiêu đề", () => {
    expect(toSheetData(["A"], [["x"], ["y"], ["z"]])).toHaveLength(4);
  });
});
