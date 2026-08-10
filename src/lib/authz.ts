/* Xác thực bằng Firebase Auth + vai trò đọc từ document users/{uid}.
   Không dùng custom claims: claims phải gán bằng Admin SDK hoặc Cloud
   Functions, quá nặng so với nhu cầu vài tài khoản của chương trình này.
   Đánh đổi: mỗi lần rules kiểm tra quyền phải đọc thêm một document. */
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { AuthUser, Role } from "../types";

/* Sai email và sai mật khẩu cố tình dùng chung một câu: nếu tách ra,
   người ngoài có thể dò xem email nào đã có tài khoản. */
const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "Email không hợp lệ.",
  "auth/user-disabled": "Tài khoản đã bị vô hiệu hóa.",
  "auth/user-not-found": "Email hoặc mật khẩu không đúng.",
  "auth/wrong-password": "Email hoặc mật khẩu không đúng.",
  "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
  "auth/too-many-requests": "Sai quá nhiều lần. Vui lòng thử lại sau ít phút.",
  "auth/network-request-failed": "Không có kết nối mạng. Kiểm tra lại đường truyền.",
  "auth/no-role": "Tài khoản chưa được cấp quyền. Liên hệ quản trị viên.",
};

export function authErrorMessage(code: string): string {
  return MESSAGES[code] || "Đăng nhập không thành công. Vui lòng thử lại.";
}

/* Đọc vai trò. Trả null khi chưa có document users/{uid} hoặc vai trò
   không hợp lệ — tài khoản đăng nhập được nhưng chưa được cấp quyền. */
async function loadRole(user: User): Promise<AuthUser | null> {
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return null;

  const data = snap.data() as { role?: string; displayName?: string; email?: string };
  if (data.role !== "admin" && data.role !== "teacher") return null;

  return {
    uid: user.uid,
    email: data.email || user.email || "",
    displayName: data.displayName || user.email || "",
    role: data.role as Role,
  };
}

/* Theo dõi trạng thái đăng nhập. Trả hàm hủy đăng ký để useEffect dọn dẹp. */
export function onAuthChange(cb: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      cb(null);
      return;
    }
    try {
      const authed = await loadRole(user);
      if (!authed) {
        // Có phiên Auth nhưng không có vai trò: đăng xuất để không kẹt ở
        // trạng thái nửa vời (đăng nhập rồi mà mọi lệnh đọc đều bị từ chối).
        await signOut(auth);
        cb(null);
        return;
      }
      cb(authed);
    } catch {
      cb(null);
    }
  });
}

export async function signIn(email: string, password: string): Promise<void> {
  // Giữ phiên qua các lần đóng/mở trình duyệt, thay cho localStorage thủ công trước đây.
  await setPersistence(auth, browserLocalPersistence);
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

  const authed = await loadRole(cred.user);
  if (!authed) {
    await signOut(auth);
    const err = new Error("no-role") as Error & { code: string };
    err.code = "auth/no-role";
    throw err;
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
