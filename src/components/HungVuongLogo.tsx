import React from "react";
import hvLogo from "../Logo/z6392669256460_b21bd9893fa35fae4541f689a3343441.jpg";

interface HungVuongLogoProps {
  showSlogan?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
}

/**
 * Official BỆNH VIỆN ĐA KHOA HÙNG VƯƠNG mark.
 * Uses the real logo image alongside the brand typography.
 */
export default function HungVuongLogo({
  showSlogan = true,
  className = "",
  size = "md",
  variant = "light",
}: HungVuongLogoProps) {
  const sizeClasses = {
    sm: "w-9 h-9",
    md: "w-11 h-11",
    lg: "w-16 h-16",
  };

  const isDark = variant === "dark";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`flex-shrink-0 ${sizeClasses[size]}`}>
        <img
          src={hvLogo}
          alt="Logo Bệnh viện Đa khoa Hùng Vương"
          draggable={false}
          className="w-full h-full object-contain rounded-md select-none drop-shadow-sm"
        />
      </div>

      {/* Brand typography */}
      <div className="flex flex-col text-left leading-none">
        <h2 className="font-sans font-black tracking-tight text-sm sm:text-base uppercase">
          <span className={`${isDark ? "text-blue-400" : "text-blue-700"} block sm:inline`}>BỆNH VIỆN ĐA KHOA</span>{" "}
          <span className={`${isDark ? "text-white" : "text-slate-900"} block sm:inline`}>HÙNG VƯƠNG</span>
        </h2>
        {showSlogan && (
          <span className={`font-serif italic text-[10px] sm:text-xs font-semibold mt-1 tracking-wide ${isDark ? "text-red-400" : "text-red-500"}`}>
            Thân thiện - Chuyên nghiệp - Chu đáo
          </span>
        )}
      </div>
    </div>
  );
}
