import { describe, it, expect } from "vitest";
import { authErrorMessage, normalizeRole } from "./authz";

describe("normalizeRole", () => {
  it("chấp nhận giá trị đúng", () => {
    expect(normalizeRole("admin")).toBe("admin");
    expect(normalizeRole("teacher")).toBe("teacher");
  });

  it("bỏ qua hoa/thường và khoảng trắng thừa, vì giá trị này gõ tay vào Console", () => {
    expect(normalizeRole("  Admin ")).toBe("admin");
    expect(normalizeRole("TEACHER")).toBe("teacher");
  });

  it("trả null cho vai trò lạ, thiếu, hoặc sai kiểu", () => {
    expect(normalizeRole("giao vu")).toBeNull();
    expect(normalizeRole("")).toBeNull();
    expect(normalizeRole(undefined)).toBeNull();
    expect(normalizeRole(null)).toBeNull();
    expect(normalizeRole(1)).toBeNull();
  });
});

describe("authErrorMessage", () => {
  it("trả cùng một câu cho sai email và sai mật khẩu, để không lộ email nào có thật", () => {
    const a = authErrorMessage("auth/user-not-found");
    const b = authErrorMessage("auth/wrong-password");
    const c = authErrorMessage("auth/invalid-credential");
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toBe("Email hoặc mật khẩu không đúng.");
  });

  it("nói rõ khi bị chặn vì thử quá nhiều lần", () => {
    expect(authErrorMessage("auth/too-many-requests"))
      .toBe("Sai quá nhiều lần. Vui lòng thử lại sau ít phút.");
  });

  it("nói rõ khi mất mạng, vì đây là lỗi người dùng tự sửa được", () => {
    expect(authErrorMessage("auth/network-request-failed"))
      .toBe("Không có kết nối mạng. Kiểm tra lại đường truyền.");
  });

  it("nói rõ khi tài khoản đăng nhập được nhưng chưa được cấp vai trò", () => {
    expect(authErrorMessage("auth/no-role")).toBe("Tài khoản chưa được cấp quyền.");
  });

  it("phân biệt rules chặn với thiếu vai trò — hai nguyên nhân, hai cách sửa", () => {
    expect(authErrorMessage("permission-denied"))
      .not.toBe(authErrorMessage("auth/no-role"));
    expect(authErrorMessage("permission-denied")).toContain("Rules");
  });

  it("có câu dự phòng cho mã lỗi lạ", () => {
    expect(authErrorMessage("auth/khong-ton-tai"))
      .toBe("Đăng nhập không thành công. Vui lòng thử lại.");
  });
});
