import React, { useState } from "react";
import { Lock, ShieldCheck, Eye, EyeOff, AlertCircle } from "lucide-react";
import { checkTeacherPassword, setTeacherAuthed } from "../lib/auth";

interface TeacherLoginProps {
  onSuccess: () => void;
}

export default function TeacherLogin({ onSuccess }: TeacherLoginProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkTeacherPassword(password)) {
      setTeacherAuthed();
      setError(false);
      onSuccess();
    } else {
      setError(true);
      setPassword("");
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
              Nhập mật khẩu để mở trang quản trị.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="teacher-password"
              className="block text-[13.5px] font-bold text-ink-2 mb-2"
            >
              Mật khẩu giảng viên
            </label>
            <div className="relative">
              <input
                id="teacher-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                autoFocus
                placeholder="••••••••"
                aria-invalid={error}
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
            {error && (
              <p className="flex items-center gap-1.5 text-[13px] text-danger-deep mt-2 font-semibold">
                <AlertCircle className="w-4 h-4 flex-none" />
                Mật khẩu không đúng. Vui lòng thử lại.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary w-full flex items-center justify-center gap-2 px-4 py-3 text-[15px] cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            Đăng nhập
          </button>
        </form>

        <p className="text-[12.5px] text-ink-4 leading-relaxed pt-1 border-t border-line-soft">
          Chỉ dành cho giảng viên phụ trách lớp. Học viên vui lòng quay lại trang khảo sát.
        </p>
      </div>
    </div>
  );
}
