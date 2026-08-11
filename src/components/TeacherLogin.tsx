import React, { useState } from "react";
import { Lock, ShieldCheck, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { signIn, authErrorMessage, RoleNotGrantedError, RoleIssue } from "../lib/authz";

interface TeacherLoginProps {
  onSuccess: () => void;
}

export default function TeacherLogin({ onSuccess }: TeacherLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issue, setIssue] = useState<RoleIssue | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    setIssue(null);
    try {
      await signIn(email, password);
      onSuccess();
    } catch (err) {
      const code = (err as { code?: string }).code || "";
      setError(authErrorMessage(code));
      /* Thiếu vai trò là lỗi VẬN HÀNH, không phải người dùng gõ sai. Hiện đủ
         uid và database để người cấp quyền tạo document ngay, thay vì phải
         mở file cấu hình dò xem app đang đọc database nào. */
      if (err instanceof RoleNotGrantedError) setIssue(err.issue);
      // Xóa mật khẩu nhưng GIỮ email: gõ lại email mỗi lần sai rất phiền.
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-14 px-4">
      <div className="w-full max-w-md surface cut-corner p-8 space-y-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-field flex items-center justify-center flex-none bg-gradient-to-br from-brand-sky-deep to-brand-navy text-white shadow-[0_10px_22px_-8px_rgb(31_78_156/0.75)]">
            <Lock className="w-5.5 h-5.5" />
          </div>
          <div>
            <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">Khu vực giảng viên</h2>
            <p className="text-[13.5px] text-ink-3 mt-0.5">
              Đăng nhập bằng tài khoản được cấp để mở trang quản trị.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="teacher-email" className="block text-[13.5px] font-bold text-ink-2 mb-2">
              Email
            </label>
            <input
              id="teacher-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
              autoFocus
              autoComplete="username"
              required
              aria-invalid={!!error}
              className={`field w-full px-3.5 py-3 text-[14px] ${error ? "field-error" : ""}`}
            />
          </div>

          <div>
            <label htmlFor="teacher-password" className="block text-[13.5px] font-bold text-ink-2 mb-2">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="teacher-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                aria-invalid={!!error}
                className={`field w-full px-3.5 py-3 pr-11 text-[14px] ${error ? "field-error" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-4 hover:text-brand-navy transition-colors cursor-pointer"
                tabIndex={-1}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-[13px] text-danger-deep font-semibold" role="alert">
              <AlertCircle className="w-4 h-4 flex-none" />
              {error}
            </p>
          )}

          {issue && (
            <div className="rounded-field border border-line-soft bg-[#F6FAFD] p-3.5 space-y-2.5 text-[12.5px] text-ink-2">
              <p className="font-semibold text-ink">
                {issue.reason === "no-doc"
                  ? "Đăng nhập đã thành công, nhưng chưa có hồ sơ phân quyền cho tài khoản này."
                  : `Đã có hồ sơ phân quyền, nhưng giá trị role không hợp lệ: “${issue.foundRole}”.`}
              </p>

              <p className="text-ink-3 leading-relaxed">
                Trong Firebase Console → Firestore, <strong>chọn đúng database</strong> dưới đây
                (Console luôn mở sẵn <code>(default)</code> — app không đọc database đó), rồi tạo
                document trong collection <code>users</code>:
              </p>

              <dl className="space-y-1.5">
                <div>
                  <dt className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.08em]">Database</dt>
                  <dd className="font-mono text-[11.5px] break-all select-all">{issue.databaseId}</dd>
                </div>
                <div>
                  <dt className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.08em]">Document ID</dt>
                  <dd className="font-mono text-[11.5px] break-all select-all">{issue.uid}</dd>
                </div>
                <div>
                  <dt className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.08em]">Trường bắt buộc</dt>
                  <dd className="font-mono text-[11.5px]">role = admin</dd>
                </div>
              </dl>

              <p className="text-ink-4 text-[11.5px] leading-relaxed">
                Document ID phải là chuỗi ở trên, không phải email. Chạm vào để bôi đen rồi sao chép.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full flex items-center justify-center gap-2 px-4 py-3 text-[15px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ShieldCheck className="w-4 h-4" />}
            {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>

        <p className="text-[12.5px] text-ink-4 leading-relaxed pt-1 border-t border-line-soft">
          Chỉ dành cho giáo vụ và giảng viên phụ trách lớp. Học viên vui lòng quay lại trang khảo sát.
        </p>
      </div>
    </div>
  );
}
