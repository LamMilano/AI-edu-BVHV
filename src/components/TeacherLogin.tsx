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
    <div className="flex items-center justify-center py-16 px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-blue-600/10 text-blue-400 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/20">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Khu Vực Giảng Viên</h2>
            <p className="text-sm text-slate-400 mt-1">
              Nhập mật khẩu để truy cập trang Quản Trị Lớp Học.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
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
                className={`w-full px-4 py-2.5 pr-11 rounded-xl bg-slate-950 border text-slate-100 text-sm outline-none transition-all placeholder:text-slate-600 ${
                  error
                    ? "border-red-500/60 focus:border-red-500"
                    : "border-slate-800 focus:border-blue-500/60"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                tabIndex={-1}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && (
              <p className="flex items-center gap-1.5 text-xs text-red-400 mt-2 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Mật khẩu không đúng. Vui lòng thử lại.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
            Đăng nhập
          </button>
        </form>

        <p className="text-[11px] text-slate-600 text-center leading-relaxed">
          Chỉ dành cho giảng viên phụ trách lớp. Học viên vui lòng quay lại trang Khảo Sát.
        </p>
      </div>
    </div>
  );
}
