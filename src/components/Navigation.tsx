import React, { useState } from "react";
import { GraduationCap, FileText, LayoutDashboard, Menu, X, ToggleLeft, ToggleRight } from "lucide-react";
import HungVuongLogo from "./HungVuongLogo";

interface NavigationProps {
  activeTab: "home" | "survey" | "admin";
  setActiveTab: (tab: "home" | "survey" | "admin") => void;
  isAdmin: boolean;
  onLogout: () => void;
}

export default function Navigation({ activeTab, setActiveTab, isAdmin, onLogout }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-slate-950/80 border-b border-slate-800/60 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and branding */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => setActiveTab("home")}>
              <HungVuongLogo showSlogan={true} size="md" variant="dark" />
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1.5">
            <button
              id="nav-home"
              onClick={() => setActiveTab("home")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === "home"
                  ? "bg-blue-600/15 text-blue-400 border border-blue-500/20"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Chương Trình Đào Tạo
            </button>

            <button
              id="nav-survey"
              onClick={() => setActiveTab("survey")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === "survey"
                  ? "bg-blue-600/15 text-blue-400 border border-blue-500/20"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              Khảo Sát Phân Lớp
            </button>

            <button
              id="nav-admin"
              onClick={() => setActiveTab("admin")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === "admin"
                  ? "bg-blue-600/15 text-blue-400 border border-blue-500/20"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Quản Trị Lớp Học
            </button>

            <div className="h-5 w-[1px] bg-slate-800 mx-2" />

            {/* Quyền Giảng viên: TẮT = mở form đăng nhập; BẬT = đăng xuất */}
            <button
              id="nav-toggle-role"
              onClick={() => {
                if (isAdmin) {
                  onLogout();
                } else {
                  setActiveTab("admin");
                }
              }}
              title={isAdmin ? "Đăng xuất khỏi quyền giảng viên" : "Đăng nhập quyền giảng viên"}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition-all text-xs text-slate-400 cursor-pointer"
            >
              <span className="font-mono">Quyền GV:</span>
              {isAdmin ? (
                <div className="flex items-center gap-1 text-emerald-400 font-bold">
                  <span>BẬT</span>
                  <ToggleRight className="w-5 h-5 text-emerald-400" />
                </div>
              ) : (
                <div className="flex items-center gap-1 text-slate-500 font-medium">
                  <span>TẮT</span>
                  <ToggleLeft className="w-5 h-5 text-slate-500" />
                </div>
              )}
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              id="nav-mobile-toggle"
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 focus:outline-none"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-slate-950 border-b border-slate-800 px-2 pt-2 pb-4 space-y-1">
          <button
            id="nav-mobile-home"
            onClick={() => {
              setActiveTab("home");
              setIsOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-base font-medium ${
              activeTab === "home" 
                ? "bg-blue-600/15 text-blue-400 border border-blue-500/20" 
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <GraduationCap className="w-5 h-5" />
            Chương Trình Đào Tạo
          </button>

          <button
            id="nav-mobile-survey"
            onClick={() => {
              setActiveTab("survey");
              setIsOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-base font-medium ${
              activeTab === "survey" 
                ? "bg-blue-600/15 text-blue-400 border border-blue-500/20" 
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <FileText className="w-5 h-5" />
            Khảo Sát Phân Lớp
          </button>

          <button
            id="nav-mobile-admin"
            onClick={() => {
              setActiveTab("admin");
              setIsOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-base font-medium ${
              activeTab === "admin" 
                ? "bg-blue-600/15 text-blue-400 border border-blue-500/20" 
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Quản Trị Lớp Học
          </button>

          <div className="h-[1px] bg-slate-800 my-2 mx-4" />

          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Quyền Giảng viên:</span>
            <button
              id="nav-mobile-toggle-role"
              onClick={() => {
                if (isAdmin) {
                  onLogout();
                } else {
                  setActiveTab("admin");
                }
                setIsOpen(false);
              }}
              className="flex items-center gap-1.5"
            >
              {isAdmin ? (
                <span className="text-emerald-400 font-bold text-sm flex items-center gap-1">
                  Đang Bật <ToggleRight className="w-6 h-6 text-emerald-400" />
                </span>
              ) : (
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  Đang Tắt <ToggleLeft className="w-6 h-6 text-slate-500" />
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
