import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, AlertCircle, ChevronDown, Check } from "lucide-react";
import {
  searchDepartments,
  canonicalDepartment,
  DepartmentMatch,
} from "../lib/departments";

/* Ô chọn Khoa / Phòng / Ban.
   Gõ để lọc nhanh (không dấu cũng ra, gõ tắt "hscc" cũng ra), nhưng chỉ
   nhận giá trị nằm trong danh mục chuẩn — nếu ai đó gõ tay một tên lạ,
   bước kiểm tra ở SurveyForm sẽ chặn lại. */

interface DepartmentFieldProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

/** Tô đậm đúng đoạn khớp với chữ người dùng vừa gõ. */
function Highlighted({ name, hit, hitLength }: DepartmentMatch) {
  if (hit < 0 || hitLength === 0) return <>{name}</>;
  return (
    <>
      {name.slice(0, hit)}
      <mark className="bg-transparent text-brand-navy font-extrabold">
        {name.slice(hit, hit + hitLength)}
      </mark>
      {name.slice(hit + hitLength)}
    </>
  );
}

export default function DepartmentField({
  id, label, value, error, onChange,
}: DepartmentFieldProps) {
  const [open, setOpen] = useState(false);
  // Chữ đang gõ; khi đóng danh sách thì hiển thị lại giá trị đã chọn.
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(
    () => (open ? searchDepartments(query) : []),
    [open, query]
  );

  const listId = `${id}-listbox`;

  /* Thẻ chứa form dùng clip-path (góc vát 45°) nên mọi thứ tràn ra ngoài đều
     bị cắt. Vì vậy danh sách được gắn thẳng vào <body> qua portal và định vị
     bằng toạ độ thực của ô nhập. */
  const [rect, setRect] = useState<{ left: number; top: number; width: number; maxH: number; up: boolean } | null>(null);

  const measure = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 16;
    const above = r.top - 16;
    const up = below < 200 && above > below;
    setRect({
      left: r.left,
      top: up ? r.top : r.bottom,
      width: r.width,
      maxH: Math.max(140, Math.min(264, up ? above : below)),
      up,
    });
  };

  useLayoutEffect(() => {
    if (!open) { setRect(null); return; }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  // Bấm ra ngoài: đóng danh sách, bỏ chữ gõ dở, giữ giá trị đã chọn.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inField = wrapRef.current?.contains(target);
      const inList = listRef.current?.contains(target);
      if (!inField && !inList) commitOrRevert();
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  });

  // Cuộn mục đang chọn vào tầm nhìn khi di chuyển bằng phím mũi tên.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`#${id}-opt-${active}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);

  const openList = () => {
    setQuery("");
    setActive(Math.max(0, searchDepartments("").findIndex(m => m.name === value)));
    setOpen(true);
  };

  const pick = (name: string) => {
    onChange(name);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  /** Rời ô nhập: chữ đã gõ trùng một khoa/phòng thì chốt tên chuẩn, còn lại
      giữ nguyên giá trị cũ thay vì để lại chữ dở dang trong ô. */
  const commitOrRevert = () => {
    const typed = query.trim();
    if (typed) {
      const exact = canonicalDepartment(typed);
      if (exact) onChange(exact);
      else if (matches.length === 1) onChange(matches[0].name);
    }
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { openList(); return; }
      if (matches.length === 0) return;
      setActive(prev => {
        const next = e.key === "ArrowDown" ? prev + 1 : prev - 1;
        return (next + matches.length) % matches.length;
      });
      return;
    }
    if (e.key === "Enter") {
      if (open && matches[active]) {
        e.preventDefault();
        pick(matches[active].name);
      }
      return;
    }
    if (e.key === "Escape") {
      if (open) { e.preventDefault(); setQuery(""); setOpen(false); }
      return;
    }
    if (e.key === "Tab" && open) {
      commitOrRevert();
    }
  };

  const shown = open ? query : value;

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor={id} className="block text-[13.5px] font-bold text-ink-2 mb-2">
        {label}
      </label>

      <div className="relative">
        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4 pointer-events-none" />
        <input
          ref={inputRef}
          id={id}
          name="department"
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${id}-opt-${active}` : undefined}
          aria-invalid={Boolean(error)}
          value={shown}
          placeholder={value ? value : "Gõ để tìm — ví dụ: Nhi, hscc, tieu hoa…"}
          onChange={(e) => {
            if (!open) setOpen(true);
            setQuery(e.target.value);
            setActive(0);
          }}
          onFocus={() => { if (!open) openList(); }}
          onClick={() => { if (!open) openList(); }} // bấm lại vào ô đang focus vẫn mở danh sách
          onKeyDown={handleKeyDown}
          className={`field w-full pl-10 pr-10 py-3 text-[14px] ${error ? "field-error" : ""}`}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Đóng danh sách khoa/phòng" : "Mở danh sách khoa/phòng"}
          // Xử lý ngay ở mousedown và chặn mặc định: ô nhập không bị mất focus,
          // tránh chuỗi focus → mở → click → đóng khi bấm mũi tên lúc đang đóng.
          onMouseDown={(e) => {
            e.preventDefault();
            if (open) commitOrRevert();
            else { inputRef.current?.focus(); openList(); }
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-4 hover:text-brand-navy"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && rect && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Danh sách khoa / phòng / ban"
          style={{
            position: "fixed",
            left: rect.left,
            top: rect.up ? undefined : rect.top + 6,
            bottom: rect.up ? window.innerHeight - rect.top + 6 : undefined,
            width: rect.width,
            maxHeight: rect.maxH,
          }}
          className="z-50 overflow-y-auto surface border border-line py-1.5 shadow-[0_18px_40px_-16px_rgb(20_51_110/0.45)]"
        >
          {matches.length === 0 ? (
            <li className="px-3.5 py-3 text-[13px] text-ink-4">
              Không có khoa/phòng nào khớp. Hãy thử gõ ngắn hơn hoặc bỏ dấu.
            </li>
          ) : (
            matches.map((m, i) => {
              const selected = m.name === value;
              return (
                <li
                  key={m.name}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()} // giữ focus cho ô nhập
                  onClick={() => pick(m.name)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-[13.5px] cursor-pointer ${
                    i === active ? "bg-[#eaf4fd] text-brand-navy-deep" : "text-ink-2"
                  }`}
                >
                  <Check className={`w-3.5 h-3.5 flex-none ${selected ? "text-brand-sky-deep" : "opacity-0"}`} />
                  <span><Highlighted {...m} /></span>
                </li>
              );
            })
          )}
        </ul>,
        document.body
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-[13px] text-danger-deep mt-1.5 font-semibold">
          <AlertCircle className="w-3.5 h-3.5 flex-none" />
          {error}
        </p>
      )}
    </div>
  );
}
