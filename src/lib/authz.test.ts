import { describe, it, expect } from "vitest";
import { authErrorMessage } from "./authz";

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
    expect(authErrorMessage("auth/no-role"))
      .toBe("Tài khoản chưa được cấp quyền. Liên hệ quản trị viên.");
  });

  it("có câu dự phòng cho mã lỗi lạ", () => {
    expect(authErrorMessage("auth/khong-ton-tai"))
      .toBe("Đăng nhập không thành công. Vui lòng thử lại.");
  });
});
