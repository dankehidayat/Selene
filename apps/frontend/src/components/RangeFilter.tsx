import { useState, useCallback, useEffect, useMemo } from "react";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronDown, Clock, X } from "lucide-react";
import { controlBtnClass } from "./ChartCard";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface RangeFilterProps {
  /** ISO string or null for default label */
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
  /** Label shown when both from/to are null (default "24 Hours") */
  emptyLabel?: string;
}

export interface DatePickerRowProps {
  label: string; // "From" / "To"
  date: string; // YYYY-MM-DD or empty
  onChange: (d: string) => void;
  min?: string;
  max?: string;
  showTime?: boolean;
  time?: string; // HH:MM
  onTimeChange?: (t: string) => void;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const YEAR_OPTIONS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

/* ------------------------------------------------------------------ */
/* Date helpers (local-time safe)                                      */
/* ------------------------------------------------------------------ */

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toLocalTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateLabel(d: Date): string {
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function parseDateParts(s: string): { day: number; month: number; year: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { day: d, month: m, year: y };
}

/** Clamp a day-of-month to the valid range for the given month/year. */
function clampDay(day: number, month: number, year: number): number {
  const maxDays = new Date(year, month, 0).getDate();
  return Math.max(1, Math.min(day, maxDays));
}

function buildDateString(day: number, month: number, year: number): string {
  const clamped = clampDay(day, month, year);
  return `${year}-${String(month).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}

/* ================================================================== */
/* RangeFilter — popover with collapsible From / To date sections      */
/* ================================================================== */

export function RangeFilter({ from, to, onChange, emptyLabel = "24 Hours" }: RangeFilterProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const yesterday = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d;
  }, [today]);

  // Draft state: date parts as "YYYY-MM-DD", time parts as "HH:MM"
  const [draftFromDate, setDraftFromDate] = useState(() =>
    from ? toLocalDateString(new Date(from)) : toLocalDateString(yesterday),
  );
  const [draftToDate, setDraftToDate] = useState(() =>
    to ? toLocalDateString(new Date(to)) : toLocalDateString(today),
  );
  const [draftFromTime, setDraftFromTime] = useState(() =>
    from ? toLocalTimeString(new Date(from)) : "00:00",
  );
  const [draftToTime, setDraftToTime] = useState(() =>
    to ? toLocalTimeString(new Date(to)) : "23:59",
  );
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const sameDate = draftFromDate === draftToDate;
  const showTime = sameDate && fromOpen && toOpen;

  // Derive day/month/year parts from draft strings
  const fromParts = useMemo(() => parseDateParts(draftFromDate), [draftFromDate]);
  const toParts = useMemo(() => parseDateParts(draftToDate), [draftToDate]);

  // Detect narrow viewport for mobile bottom-sheet layout
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Reset draft when external from/to change while closed
  useEffect(() => {
    if (!open) {
      setDraftFromDate(from ? toLocalDateString(new Date(from)) : toLocalDateString(yesterday));
      setDraftToDate(to ? toLocalDateString(new Date(to)) : toLocalDateString(today));
      setDraftFromTime(from ? toLocalTimeString(new Date(from)) : "00:00");
      setDraftToTime(to ? toLocalTimeString(new Date(to)) : "23:59");
      setFromOpen(false);
      setToOpen(false);
    }
  }, [from, to, open, today, yesterday]);

  const handleApply = useCallback(() => {
    const fromDate = new Date(`${draftFromDate}T${sameDate ? draftFromTime : "00:00"}`);
    const toDate = new Date(`${draftToDate}T${sameDate ? draftToTime : "23:59"}`);
    // Ensure to is after from — default to +1h if equal/inverted
    if (toDate <= fromDate) toDate.setTime(fromDate.getTime() + 3600000);
    onChange(fromDate.toISOString(), toDate.toISOString());
    setOpen(false);
  }, [draftFromDate, draftToDate, draftFromTime, draftToTime, sameDate, onChange]);

  const handleReset = useCallback(() => {
    onChange(null, null);
    setOpen(false);
  }, [onChange]);

  const label = useMemo(() => {
    if (!from || !to) return emptyLabel;
    const f = new Date(from);
    const t = new Date(to);
    const fStr = toLocalDateString(f);
    const tStr = toLocalDateString(t);
    if (fStr === tStr) {
      return `${formatDateLabel(f)} ${toLocalTimeString(f)} – ${toLocalTimeString(t)}`;
    }
    return `${formatDateLabel(f)} – ${formatDateLabel(t)}`;
  }, [from, to, emptyLabel]);

  // Handlers for From date parts
  const handleFromDay = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (isNaN(val)) return;
      setDraftFromDate(buildDateString(val, fromParts.month, fromParts.year));
    },
    [fromParts],
  );

  const handleFromMonth = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const m = parseInt(e.target.value, 10);
      setDraftFromDate(buildDateString(fromParts.day, m, fromParts.year));
    },
    [fromParts],
  );

  const handleFromYear = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const y = parseInt(e.target.value, 10);
      setDraftFromDate(buildDateString(fromParts.day, fromParts.month, y));
    },
    [fromParts],
  );

  // Handlers for To date parts
  const handleToDay = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (isNaN(val)) return;
      setDraftToDate(buildDateString(val, toParts.month, toParts.year));
    },
    [toParts],
  );

  const handleToMonth = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const m = parseInt(e.target.value, 10);
      setDraftToDate(buildDateString(toParts.day, m, toParts.year));
    },
    [toParts],
  );

  const handleToYear = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const y = parseInt(e.target.value, 10);
      setDraftToDate(buildDateString(toParts.day, toParts.month, y));
    },
    [toParts],
  );

  // Renders one collapsible date section
  const renderDateSection = (
    sectionLabel: string,
    open: boolean,
    onToggle: () => void,
    parts: { day: number; month: number; year: number },
    onDay: (e: React.ChangeEvent<HTMLInputElement>) => void,
    onMonth: (e: React.ChangeEvent<HTMLSelectElement>) => void,
    onYear: (e: React.ChangeEvent<HTMLSelectElement>) => void,
  ) => (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-b-0 pb-2 last:pb-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-gray-700 dark:text-gray-200 py-1.5 hover:text-gray-900 dark:hover:text-white transition outline-none"
      >
        <CalendarDays size={13} className="text-gray-400 dark:text-gray-500 shrink-0" />
        <span className="flex-1">{sectionLabel}</span>
        <ChevronDown
          size={12}
          className={cn(
            "text-gray-400 dark:text-gray-500 transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="flex items-center gap-1.5 pb-2">
          {/* Day */}
          <input
            type="number"
            min={1}
            max={31}
            value={parts.day}
            onChange={onDay}
            className={cn(controlBtnClass, "w-14 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none")}
            aria-label={`${sectionLabel} day`}
          />
          {/* Month */}
          <select
            value={parts.month}
            onChange={onMonth}
            className={cn(controlBtnClass, "w-24")}
            aria-label={`${sectionLabel} month`}
          >
            {FULL_MONTHS.map((name, idx) => (
              <option key={idx} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          {/* Year */}
          <select
            value={parts.year}
            onChange={onYear}
            className={cn(controlBtnClass, "w-20")}
            aria-label={`${sectionLabel} year`}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  const body = (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Time Range
        </span>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      {renderDateSection(
        "From",
        fromOpen,
        () => setFromOpen((v) => !v),
        fromParts,
        handleFromDay,
        handleFromMonth,
        handleFromYear,
      )}

      {renderDateSection(
        "To",
        toOpen,
        () => setToOpen((v) => !v),
        toParts,
        handleToDay,
        handleToMonth,
        handleToYear,
      )}

      {showTime && (
        <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              <Clock size={11} className="text-gray-400" />
              From time
            </label>
            <input
              type="time"
              value={draftFromTime}
              onChange={(e) => setDraftFromTime(e.target.value)}
              className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              <Clock size={11} className="text-gray-400" />
              To time
            </label>
            <input
              type="time"
              value={draftToTime}
              onChange={(e) => setDraftToTime(e.target.value)}
              className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={handleApply}
          className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          Apply
        </button>
        <button
          onClick={handleReset}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          Reset ({emptyLabel})
        </button>
      </div>
    </>
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={controlBtnClass}>
          <CalendarDays size={13} className="text-gray-500 dark:text-gray-300" />
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        {isMobile ? (
          <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setOpen(false)}
            />
            {/* Sheet */}
            <div
              className="relative bg-white dark:bg-gray-800 rounded-t-xl border-x border-t border-gray-100 dark:border-gray-700 shadow-xl p-4 w-full max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {body}
            </div>
          </div>
        ) : (
          <Popover.Content
            align="end"
            sideOffset={6}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg p-4 z-50 w-[320px] max-w-[calc(100vw-2rem)]"
          >
            {body}
          </Popover.Content>
        )}
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ================================================================== */
/* DatePickerRow — compact day/month/year + optional time inputs       */
/* Used standalone in DataLog's export-by-range section.               */
/* ================================================================== */

export function DatePickerRow({ label, date, onChange, min: _min, max: _max, showTime, time, onTimeChange }: DatePickerRowProps) {
  // When date is empty, derive a default from today
  const resolved = useMemo(() => {
    const src = date || toLocalDateString(new Date());
    return parseDateParts(src);
  }, [date]);

  const handleDay = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (isNaN(val)) return;
      onChange(buildDateString(val, resolved.month, resolved.year));
    },
    [resolved, onChange],
  );

  const handleMonth = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const m = parseInt(e.target.value, 10);
      onChange(buildDateString(resolved.day, m, resolved.year));
    },
    [resolved, onChange],
  );

  const handleYear = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const y = parseInt(e.target.value, 10);
      onChange(buildDateString(resolved.day, resolved.month, y));
    },
    [resolved, onChange],
  );

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {/* Day */}
        <input
          type="number"
          min={1}
          max={31}
          value={resolved.day}
          onChange={handleDay}
          className={cn(controlBtnClass, "w-14 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none")}
          aria-label={`${label} day`}
        />
        {/* Month */}
        <select
          value={resolved.month}
          onChange={handleMonth}
          className={cn(controlBtnClass, "w-24")}
          aria-label={`${label} month`}
        >
          {FULL_MONTHS.map((name, idx) => (
            <option key={idx} value={idx + 1}>
              {name}
            </option>
          ))}
        </select>
        {/* Year */}
        <select
          value={resolved.year}
          onChange={handleYear}
          className={cn(controlBtnClass, "w-20")}
          aria-label={`${label} year`}
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {showTime && onTimeChange && time !== undefined && (
        <div className="flex items-center gap-1.5">
          <Clock size={11} className="text-gray-400 shrink-0" />
          <input
            type="time"
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]"
            aria-label={`${label} time`}
          />
        </div>
      )}
    </div>
  );
}