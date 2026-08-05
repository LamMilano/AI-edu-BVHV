import React from "react";
import { Search, RotateCcw } from "lucide-react";
import { LEVEL_LABEL } from "../lib/levels";
import {
  useStudentFilters,
  DATE_PRESETS,
  SORT_OPTIONS,
  LevelFilter,
} from "../hooks/useStudentFilters";

/* Thanh lọc không tự giữ trạng thái — mọi thứ đến từ useStudentFilters, để chỉ
   có một nơi duy nhất định nghĩa danh sách đang hiển thị. */
type Props = ReturnType<typeof useStudentFilters>;

/** Nhóm nút gạt dùng chung cho bộ lọc cấp độ và bộ lọc thời gian.
    Nhận thẳng danh sách lựa chọn thay vì children, để `key` nằm trên thẻ
    <button> gốc — dự án chưa cài @types/react nên key trên component tự viết
    không được TypeScript chấp nhận. */
function ToggleGroup<T extends string>({ idPrefix, options, value, onChange }: {
  idPrefix: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="inline-flex self-start rounded-field p-[3px] gap-0.5 bg-gradient-to-b from-[#EDF3FA] to-[#E1EAF4]">
      {options.map((opt) => (
        <button
          key={opt.value}
          id={`${idPrefix}-${opt.value}`}
          onClick={() => onChange(opt.value)}
          className={`px-3.5 py-1.5 rounded-[6px] text-[12.5px] font-bold transition-all cursor-pointer whitespace-nowrap ${
            value === opt.value
              ? "bg-white text-brand-navy shadow-[0_2px_5px_-2px_rgb(20_51_110/0.3)]"
              : "text-ink-3 hover:text-ink"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* Nhãn nút cấp độ: "Cấp độ 1" quá dài cho nút gạt nên rút thành "C1". */
const LEVEL_OPTIONS: { value: LevelFilter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "L1", label: LEVEL_LABEL.L1.replace("Cấp độ ", "C") },
  { value: "L2", label: LEVEL_LABEL.L2.replace("Cấp độ ", "C") },
  { value: "L3", label: LEVEL_LABEL.L3.replace("Cấp độ ", "C") },
];

export default function StudentFilterBar({
  departments, totalCount, visibleCount, isFiltered, dateRangeError,
  searchTerm, levelFilter, departmentFilter, datePreset, customFrom, customTo, sortKey,
  setSearchTerm, setLevelFilter, setDepartmentFilter, setDatePreset,
  setCustomFrom, setCustomTo, setSortKey, resetAll,
}: Props) {
  return (
    <div className="space-y-3">
      {/* ── Hàng 1: tìm kiếm + cấp độ ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4 pointer-events-none" />
          <input
            id="search-students"
            type="text"
            placeholder="Tìm theo tên hoặc khoa…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="field w-full pl-10 pr-4 py-2.5 text-[14px]"
          />
        </div>

        {/* Lọc cấp độ dạng nút gạt — nhanh hơn thả xuống khi chỉ có 4 lựa chọn */}
        <ToggleGroup
          idPrefix="filter-level"
          options={LEVEL_OPTIONS}
          value={levelFilter}
          onChange={setLevelFilter}
        />
      </div>

      {/* ── Hàng 2: khoa · thời gian · sắp xếp ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 pt-3 border-t border-line-soft">
        <select
          id="filter-department"
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="field px-3 py-2 text-[13px] font-semibold max-w-[240px] cursor-pointer"
        >
          <option value="ALL">Tất cả khoa / phòng</option>
          {departments.map((dep) => (
            <option key={dep} value={dep}>{dep}</option>
          ))}
        </select>

        <ToggleGroup
          idPrefix="filter-date"
          options={DATE_PRESETS}
          value={datePreset}
          onChange={setDatePreset}
        />

        <select
          id="sort-students"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
          className="field px-3 py-2 text-[13px] font-semibold cursor-pointer"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {isFiltered && (
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-[12.5px] text-ink-3 tnum">
              Hiển thị <b className="text-ink">{visibleCount}</b> / {totalCount} học viên
            </span>
            <button
              id="btn-reset-filters"
              onClick={resetAll}
              className="flex items-center gap-1.5 text-[12.5px] font-bold text-brand-navy hover:text-brand-sky-deep transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Xóa lọc
            </button>
          </div>
        )}
      </div>

      {/* Hai ô ngày chỉ xuất hiện khi thật sự cần — đỡ chật thanh lọc */}
      {datePreset === "CUSTOM" && (
        <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
          <label className="text-ink-3 font-semibold">Từ ngày</label>
          <input
            id="filter-date-from"
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className={`field px-3 py-2 tnum cursor-pointer ${dateRangeError ? "field-error" : ""}`}
          />
          <label className="text-ink-3 font-semibold">đến</label>
          <input
            id="filter-date-to"
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className={`field px-3 py-2 tnum cursor-pointer ${dateRangeError ? "field-error" : ""}`}
          />
          {dateRangeError && (
            <span className="text-[12.5px] font-semibold text-danger">{dateRangeError}</span>
          )}
        </div>
      )}
    </div>
  );
}
