import { describe, it, expect } from "vitest";
import { normalizeEmail, normalizeName } from "./students";

describe("normalizeEmail", () => {
  it("bỏ khoảng trắng thừa và đưa về chữ thường", () => {
    expect(normalizeEmail("  Nguyen.Van.A@BvHV.vn ")).toBe("nguyen.van.a@bvhv.vn");
  });

  it("trả null khi rỗng hoặc toàn khoảng trắng", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("   ")).toBeNull();
  });

  it("trả null khi có dấu gạch chéo, vì Firestore không cho phép trong Document ID", () => {
    expect(normalizeEmail("a/b@bvhv.vn")).toBeNull();
  });

  it("trả null với '.' và '..', là hai Document ID bị Firestore cấm", () => {
    expect(normalizeEmail(".")).toBeNull();
    expect(normalizeEmail("..")).toBeNull();
  });

  it("trả null khi thiếu ký tự @, vì đó không phải email", () => {
    expect(normalizeEmail("nguyenvana")).toBeNull();
  });

  it("trả null khi dài quá giới hạn 1500 byte của Document ID", () => {
    expect(normalizeEmail("a".repeat(1500) + "@bvhv.vn")).toBeNull();
  });
});

describe("normalizeName", () => {
  it("gộp khoảng trắng thừa và đưa về chữ thường, giữ nguyên dấu tiếng Việt", () => {
    expect(normalizeName("  Nguyễn   Văn  A ")).toBe("nguyễn văn a");
  });

  it("trả chuỗi rỗng cho đầu vào rỗng", () => {
    expect(normalizeName("")).toBe("");
  });
});
