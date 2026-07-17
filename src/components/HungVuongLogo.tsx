import React from "react";

interface HungVuongLogoProps {
  showSlogan?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
}

export default function HungVuongLogo({ 
  showSlogan = true, 
  className = "", 
  size = "md",
  variant = "light"
}: HungVuongLogoProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-14 h-14"
  };

  const isDark = variant === "dark";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* SVG Vector Logo representing BỆNH VIỆN ĐA KHOA HÙNG VƯƠNG */}
      <div className={`flex-shrink-0 ${sizeClasses[size]}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm select-none">
          <defs>
            <clipPath id="diamond-clip-hv">
              <polygon points="50,4 96,50 50,96 4,50" />
            </clipPath>
          </defs>
          
          {/* Diamond background and border */}
          <polygon 
            points="50,4 96,50 50,96 4,50" 
            fill="#ffffff" 
            stroke={isDark ? "#3b82f6" : "#0a58ca"} 
            strokeWidth="5" 
            strokeLinejoin="miter" 
          />
          
          {/* Clipped inner content */}
          <g clipPath="url(#diamond-clip-hv)">
            {/* 3 Blue Vertical Columns */}
            <rect x="60" y="24" width="4.5" height="40" fill="#4b7bec" />
            <rect x="68.5" y="24" width="4.5" height="40" fill="#4b7bec" />
            <rect x="77" y="24" width="4.5" height="40" fill="#4b7bec" />
            
            {/* Light blue water wave section (bottom half) */}
            <polygon points="2,52 50,98 98,52 50,75" fill="#4fc3f7" />
            
            {/* White diagonal waves lines */}
            <line x1="28" y1="78" x2="68" y2="52" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
            <line x1="36" y1="85" x2="76" y2="59" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
            <line x1="44" y1="92" x2="84" y2="66" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
            
            {/* Red Cross */}
            <rect x="25" y="36.5" width="36" height="13" fill="#dc3545" rx="0.5" />
            <rect x="36.5" y="25" width="13" height="36" fill="#dc3545" rx="0.5" />
          </g>
        </svg>
      </div>

      {/* Brand typography with custom spacing */}
      <div className="flex flex-col text-left">
        <h2 className="font-sans font-black tracking-tight leading-tight text-sm sm:text-base uppercase">
          <span className={`${isDark ? "text-blue-400" : "text-blue-600"} block sm:inline`}>BỆNH VIỆN ĐA KHOA</span>{" "}
          <span className={`${isDark ? "text-white" : "text-slate-900"} block sm:inline`}>HÙNG VƯƠNG</span>
        </h2>
        {showSlogan && (
          <span className={`font-serif italic text-[10px] sm:text-xs font-bold leading-none mt-0.5 tracking-wide ${isDark ? "text-red-400" : "text-red-500"}`}>
            Thân thiện - Chuyên nghiệp - Chu đáo
          </span>
        )}
      </div>
    </div>
  );
}
