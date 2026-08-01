import React from "react";
import hvLogo from "../Logo/z6392669256460_b21bd9893fa35fae4541f689a3343441.jpg";

interface HungVuongLogoProps {
  showSlogan?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** `compact` bỏ tên đầy đủ, chỉ giữ dấu hiệu — dùng cho thanh nav chật. */
  variant?: "default" | "compact";
}

/**
 * Dấu hiệu chính thức BỆNH VIỆN ĐA KHOA HÙNG VƯƠNG.
 *
 * Slogan mặc định tắt: thanh nav cao 64px không đủ chỗ cho cả logo,
 * tên đầy đủ và slogan. Slogan sống ở footer, nơi nó có chỗ thở.
 */
export default function HungVuongLogo({
  showSlogan = false,
  className = "",
  size = "md",
  variant = "default",
}: HungVuongLogoProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-14 h-14",
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`flex-shrink-0 ${sizeClasses[size]}`}>
        <img
          src={hvLogo}
          alt="Logo Bệnh viện Đa khoa Hùng Vương"
          draggable={false}
          className="w-full h-full object-contain rounded-md select-none"
        />
      </div>

      <div className="flex flex-col text-left leading-tight">
        <h2 className="font-extrabold tracking-tight text-[12.5px] sm:text-[13px] uppercase text-ink">
          BỆNH VIỆN ĐA KHOA{" "}
          <span className="text-brand-navy">HÙNG VƯƠNG</span>
        </h2>

        {variant === "default" && (
          <span className="text-[10.5px] text-ink-4 mt-0.5">
            Đào tạo AI nội bộ
          </span>
        )}

        {showSlogan && (
          <span className="text-[11px] text-ink-3 mt-1 tracking-wide">
            Thân thiện · Chuyên nghiệp · Chu đáo
          </span>
        )}
      </div>
    </div>
  );
}
