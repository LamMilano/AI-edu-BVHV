import { useEffect, useMemo, useState } from "react";
import { SurveySubmission, Enrollment, ClassRecord } from "../types";
import { toDate } from "../lib/datetime";
import { rosterEmails, isInRoster, classFilterOptions } from "../lib/classRoster";

/* Toàn bộ phép lọc và sắp xếp danh sách học viên nằm ở đây, tách khỏi giao diện
   để đọc được quy tắc mà không phải lội qua JSX của bảng. */

export type LevelFilter = "ALL" | "L1" | "L2" | "L3";
export type DatePreset = "ALL" | "TODAY" | "D7" | "D30" | "CUSTOM";
export type SortKey =
  | "TIME_DESC"
  | "TIME_ASC"
  | "SCORE_DESC"
  | "SCORE_ASC"
  | "NAME_ASC";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "TIME_DESC", label: "Mới nhất trước" },
  { value: "TIME_ASC", label: "Cũ nhất trước" },
  { value: "SCORE_DESC", label: "Điểm cao → thấp" },
  { value: "SCORE_ASC", label: "Điểm thấp → cao" },
  { value: "NAME_ASC", label: "Tên A → Z" },
];

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "TODAY", label: "Hôm nay" },
  { value: "D7", label: "7 ngày" },
  { value: "D30", label: "30 ngày" },
  { value: "CUSTOM", label: "Tùy chọn" },
];

const DEFAULT_SORT: SortKey = "TIME_DESC";

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/** Đọc chuỗi yyyy-mm-dd của <input type="date"> theo giờ địa phương.
    new Date("2026-08-05") sẽ hiểu là UTC nên phải tự tách. */
function parseDateInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

export function useStudentFilters(
  submissions: SurveySubmission[],
  classes: ClassRecord[] = [],
  enrollments: Enrollment[] = []
) {
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("ALL");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT);

  // Danh sách khoa/phòng rút từ chính dữ liệu — không có bảng danh mục cố định
  const departments = useMemo(() => {
    const seen = new Set<string>();
    submissions.forEach((s) => {
      const name = (s.department || "").trim();
      if (name) seen.add(name);
    });
    return Array.from(seen).sort((a, b) => a.localeCompare(b, "vi"));
  }, [submissions]);

  // Xóa học viên cuối cùng của một khoa sẽ khiến bộ lọc trỏ vào khoa không còn
  // tồn tại, bảng rỗng mà không rõ vì sao. Đưa về "Tất cả" khi điều đó xảy ra.
  useEffect(() => {
    if (departmentFilter !== "ALL" && !departments.includes(departmentFilter)) {
      setDepartmentFilter("ALL");
    }
  }, [departments, departmentFilter]);

  // Các lớp chọn được, kèm sĩ số đang ghi danh
  const classOptions = useMemo(
    () => classFilterOptions(classes, enrollments),
    [classes, enrollments]
  );

  // Lớp bị xóa hoặc bị đóng khi bộ lọc đang trỏ vào nó — cùng lý do với khoa/phòng.
  useEffect(() => {
    if (classFilter !== "ALL" && !classOptions.some(c => c.id === classFilter)) {
      setClassFilter("ALL");
    }
  }, [classOptions, classFilter]);

  /* Danh sách ghi danh của lớp đang lọc. Dựng một lần rồi tra Set cho từng
     phiếu, thay vì quét lại mảng ghi danh ở mỗi dòng. */
  const roster = useMemo(
    () => (classFilter === "ALL" ? null : rosterEmails(enrollments, classFilter)),
    [enrollments, classFilter]
  );

  // Khoảng thời gian đang áp dụng; null nghĩa là không chặn đầu đó
  const { range, dateRangeError } = useMemo(() => {
    const now = new Date();

    if (datePreset === "ALL") {
      return { range: null, dateRangeError: "" };
    }
    if (datePreset === "TODAY") {
      return { range: { from: startOfDay(now), to: null }, dateRangeError: "" };
    }
    if (datePreset === "D7" || datePreset === "D30") {
      const days = datePreset === "D7" ? 7 : 30;
      const from = startOfDay(now);
      from.setDate(from.getDate() - (days - 1));
      return { range: { from, to: endOfDay(now) }, dateRangeError: "" };
    }

    // CUSTOM — cho phép để trống một đầu để lọc một chiều
    const fromDate = parseDateInput(customFrom);
    const toDateValue = parseDateInput(customTo);
    if (fromDate && toDateValue && fromDate > toDateValue) {
      return {
        range: null,
        dateRangeError: "Ngày bắt đầu đang sau ngày kết thúc.",
      };
    }
    if (!fromDate && !toDateValue) {
      return { range: null, dateRangeError: "" };
    }
    return {
      range: {
        from: fromDate ? startOfDay(fromDate) : null,
        to: toDateValue ? endOfDay(toDateValue) : null,
      },
      dateRangeError: "",
    };
  }, [datePreset, customFrom, customTo]);

  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    const matched = submissions.filter((s) => {
      const matchesSearch =
        !needle ||
        (s.studentName || "").toLowerCase().includes(needle) ||
        (s.department || "").toLowerCase().includes(needle);

      const matchesLevel = levelFilter === "ALL" || s.assignedLevel === levelFilter;

      const matchesDepartment =
        departmentFilter === "ALL" || (s.department || "").trim() === departmentFilter;

      const matchesClass = !roster || isInRoster(s.email, roster);

      let matchesDate = true;
      if (range) {
        const submitted = toDate(s.submittedAt);
        // Phiếu thiếu mốc thời gian không thể khẳng định nằm trong khoảng nào
        if (!submitted) matchesDate = false;
        else if (range.from && submitted < range.from) matchesDate = false;
        else if (range.to && submitted > range.to) matchesDate = false;
      }

      return matchesSearch && matchesLevel && matchesDepartment && matchesClass && matchesDate;
    });

    // Gắn sẵn mốc thời gian để không gọi toDate lặp lại trong mỗi phép so sánh
    const decorated = matched.map((sub) => ({
      sub,
      time: toDate(sub.submittedAt)?.getTime() ?? null,
    }));

    decorated.sort((a, b) => {
      switch (sortKey) {
        case "SCORE_DESC":
          return (b.sub.score ?? 0) - (a.sub.score ?? 0);
        case "SCORE_ASC":
          return (a.sub.score ?? 0) - (b.sub.score ?? 0);
        case "NAME_ASC":
          return (a.sub.studentName || "").localeCompare(b.sub.studentName || "", "vi");
        default: {
          // Phiếu không có thời gian luôn xuống cuối, dù sắp xuôi hay ngược
          if (a.time === null && b.time === null) return 0;
          if (a.time === null) return 1;
          if (b.time === null) return -1;
          return sortKey === "TIME_ASC" ? a.time - b.time : b.time - a.time;
        }
      }
    });

    return decorated.map((d) => d.sub);
  }, [submissions, searchTerm, levelFilter, departmentFilter, roster, range, sortKey]);

  const isFiltered =
    searchTerm.trim() !== "" ||
    levelFilter !== "ALL" ||
    departmentFilter !== "ALL" ||
    classFilter !== "ALL" ||
    datePreset !== "ALL";

  const resetAll = () => {
    setSearchTerm("");
    setLevelFilter("ALL");
    setDepartmentFilter("ALL");
    setClassFilter("ALL");
    setDatePreset("ALL");
    setCustomFrom("");
    setCustomTo("");
    setSortKey(DEFAULT_SORT);
  };

  return {
    // dữ liệu
    filtered,
    departments,
    classOptions,
    totalCount: submissions.length,
    visibleCount: filtered.length,
    isFiltered,
    dateRangeError,
    // trạng thái
    searchTerm,
    levelFilter,
    departmentFilter,
    classFilter,
    datePreset,
    customFrom,
    customTo,
    sortKey,
    // hành động
    setSearchTerm,
    setLevelFilter,
    setDepartmentFilter,
    setClassFilter,
    setDatePreset,
    setCustomFrom,
    setCustomTo,
    setSortKey,
    resetAll,
  };
}
