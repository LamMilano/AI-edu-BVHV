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
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, databaseId } from "./firebase";
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
  "auth/no-role": "Tài khoản chưa được cấp quyền.",
  /* Rules đã publish nhưng chặn cả việc đọc chính hồ sơ của mình — thường là
     publish nhầm sang database khác, hoặc thiếu hẳn khối match /users/{uid}. */
  "permission-denied": "Không đọc được phân quyền: Firestore Rules đang chặn. Kiểm tra rules đã publish đúng database chưa.",
};

export function authErrorMessage(code: string): string {
  return MESSAGES[code] || "Đăng nhập không thành công. Vui lòng thử lại.";
}

/* Giá trị role do người vận hành gõ tay vào Firebase Console, nên chuẩn hóa
   khoảng trắng và hoa/thường trước khi so. "Admin" là ý đúng, đừng bắt họ
   đoán rằng hệ thống phân biệt chữ hoa. */
export function normalizeRole(raw: unknown): Role | null {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === "admin" || v === "teacher" ? v : null;
}

/* Vì sao không lấy được vai trò. Mang đủ dữ kiện để màn đăng nhập chỉ ra
   chính xác phải tạo cái gì, ở đâu — thay vì để người vận hành đoán giữa
   "chưa tạo document", "tạo nhầm database" và "gõ sai role". */
export interface RoleIssue {
  reason: "no-doc" | "bad-role";
  uid: string;
  databaseId: string;
  foundRole?: string;
}

export class RoleNotGrantedError extends Error {
  code = "auth/no-role";
  issue: RoleIssue;
  constructor(issue: RoleIssue) {
    super("no-role");
    this.name = "RoleNotGrantedError";
    this.issue = issue;
  }
}

type RoleResult = { user: AuthUser; issue?: undefined } | { user?: undefined; issue: RoleIssue };

async function loadRole(user: User): Promise<RoleResult> {
  const snap = await getDoc(doc(db, "users", user.uid));

  if (!snap.exists()) {
    return { issue: { reason: "no-doc", uid: user.uid, databaseId } };
  }

  const data = snap.data() as { role?: unknown; displayName?: string; email?: string };
  const role = normalizeRole(data.role);
  if (!role) {
    return {
      issue: {
        reason: "bad-role",
        uid: user.uid,
        databaseId,
        foundRole: String(data.role ?? ""),
      },
    };
  }

  return {
    user: {
      uid: user.uid,
      email: data.email || user.email || "",
      displayName: data.displayName || user.email || "",
      role,
    },
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
      const result = await loadRole(user);
      /* Không có vai trò thì báo là chưa đăng nhập, nhưng KHÔNG tự đăng xuất:
         phiên Auth còn sống mới tạo được hồ sơ quản trị lần đầu (claimAdminProfile).
         Phiên treo không nguy hiểm — rules chặn mọi thứ trừ việc đọc hồ sơ của
         chính mình. */
      cb(result.user || null);
    } catch {
      cb(null);
    }
  });
}

export async function signIn(email: string, password: string): Promise<void> {
  // Giữ phiên qua các lần đóng/mở trình duyệt, thay cho localStorage thủ công trước đây.
  await setPersistence(auth, browserLocalPersistence);
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

  const result = await loadRole(cred.user);
  if (!result.user) {
    /* Giữ nguyên phiên Auth thay vì đăng xuất: claimAdminProfile() cần nó để
       tạo hồ sơ quản trị lần đầu. Giao diện vẫn coi như chưa đăng nhập. */
    throw new RoleNotGrantedError(result.issue);
  }
}

/* Tự tạo hồ sơ quản trị cho chính mình, lần đầu tiên.

   Chỉ chạy được nếu email đang đăng nhập nằm trong danh sách bootstrapAdmins
   của firestore.rules — điều kiện kiểm tra Ở MÁY CHỦ, nên hàm này không phải
   là lỗ hổng: người khác gọi nó cũng bị Firestore từ chối.

   Giải bài toán con gà - quả trứng: muốn vào app phải có users/{uid}, mà tạo
   document đó bằng tay đòi hỏi biết uid và chọn đúng database trong Console. */
export async function claimAdminProfile(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.");

  await setDoc(doc(db, "users", user.uid), {
    email: user.email || "",
    displayName: user.email || "",
    role: "admin",
  });
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
