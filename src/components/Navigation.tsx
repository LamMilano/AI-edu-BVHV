import React, { useState } from "react";
import { GraduationCap, FileText, LayoutDashboard, Menu, X, LogOut, KeyRound } from "lucide-react";
import HungVuongLogo from "./HungVuongLogo";

interface NavigationProps {
  activeTab: "home" | "survey" | "admin";
  setActiveTab: (tab: "home" | "survey" | "admin") => void;
  isAdmin: boolean;
  onLogout: () => void;
}

const TABS = [
  { id: "home", label: "Chương trình", icon: GraduationCap },
  { id: "survey", label: "Khảo sát xếp lớp", icon: FileText },
  { id: "admin", label: "Quản trị", icon: LayoutDashboard },
] as const;

export default function Navigation({ activeTab, setActiveTab, isAdmin, onLogout }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);

  const tabClass = (on: boolean) =>
    `flex items-center gap-2 px-4 py-2 rounded-field text-[13.5px] transition-all cursor-pointer ${
      on
        ? "bg-gradient-to-b from-[#EAF3FC] to-[#DDEBF8] text-brand-navy font-bold shadow-[0_1px_0_rgb(255_255_255/0.9)_inset]"
        : "text-ink-3 font-semibold hover:bg-white/70 hover:text-ink"
    }`;

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-[14px] bg-gradient-to-b from-white/95 to-white/80 border-b border-brand-navy/15">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <button
            onClick={() => setActiveTab("home")}
            className="flex-shrink-0 flex items-center cursor-pointer"
          >
            <HungVuongLogo size="md" />
          </button>

          {/* Điều hướng desktop */}
          <div className="hidden md:flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                id={`nav-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={tabClass(activeTab === tab.id)}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}

            <span className="w-px h-5 bg-brand-navy/15 mx-2" />

            {/* Quyền giảng viên: chưa đăng nhập thì mở form, đã đăng nhập thì thoát */}
            <button
              id="nav-toggle-role"
              onClick={() => (isAdmin ? onLogout() : setActiveTab("admin"))}
              title={isAdmin ? "Đăng xuất khỏi quyền giảng viên" : "Đăng nhập quyền giảng viên"}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-field text-[13px] font-semibold transition-all cursor-pointer ${
                isAdmin
                  ? "text-ok-deep bg-gradient-to-b from-[#ECFDF5] to-[#DCFAEE] border border-ok/25"
                  : "text-ink-3 border border-line hover:border-brand-sky-deep hover:text-brand-navy"
              }`}
            >
              {isAdmin ? <LogOut className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
              {isAdmin ? "Thoát quyền GV" : "Giảng viên"}
            </button>
          </div>

          {/* Nút menu trên điện thoại */}
          <button
            id="nav-mobile-toggle"
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-field text-ink-3 hover:text-ink hover:bg-white/70 cursor-pointer"
            aria-label={isOpen ? "Đóng menu" : "Mở menu"}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Menu điện thoại */}
      {isOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-[14px] border-b border-brand-navy/15 px-3 pt-2 pb-4 space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`nav-mobile-${tab.id}`}
              onClick={() => {
                setActiveTab(tab.id);
                setIsOpen(false);
              }}
              className={`w-full ${tabClass(activeTab === tab.id)} py-3 text-[15px]`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}

          <div className="h-px bg-line-soft my-2 mx-2" />

          <button
            id="nav-mobile-toggle-role"
            onClick={() => {
              isAdmin ? onLogout() : setActiveTab("admin");
              setIsOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-4 py-3 rounded-field text-[15px] font-semibold cursor-pointer ${
              isAdmin ? "text-ok-deep bg-gradient-to-b from-[#ECFDF5] to-[#DCFAEE]" : "text-ink-3"
            }`}
          >
            {isAdmin ? <LogOut className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
            {isAdmin ? "Thoát quyền giảng viên" : "Đăng nhập giảng viên"}
          </button>
        </div>
      )}
    </nav>
  );
}
