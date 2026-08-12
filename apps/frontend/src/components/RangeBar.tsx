// apps/frontend/src/components/RangeBar.tsx
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronDown, Clock, X } from "lucide-react";
import { controlBtnClass } from "./ChartCard";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface RangeBarProps {
  /** ISO string or null (= default 24h / all-time) */
  from: string | null;
  /** ISO string or null (= default 24h / all-time) */
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
  /** Label shown when both from/to are null (default "24 Hours") */
  emptyLabel?: string;
  /** When true, never show time inputs (DataLog) */
  dateOnly?: boolean;
  className?: string;
}

/* ------------------------------------------------------------------ */
/* Constants (mirrored from RangeFilter)                               */
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
/* Date helpers (local-time safe, mirrored from RangeFilter)           */
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
/* RangeBar — floating time-range popover (auto-applies, never pushes  */
/* content). Bottom sheet on mobile.                                    */
/* ================================================================== */

export function RangeBar({
  from,
  to,
  onChange,
  emptyLabel = "24 Hours",
  dateOnly = false,
  className,
}: RangeBarProps) {
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

  // Debounced auto-apply timer (cleared on each change and on unmount)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sameDate = draftFromDate === draftToDate;
  const showTime = sameDate && !dateOnly;
  const hasRange = Boolean(from && to);

  // Derive day/month/year parts from draft strings
  const fromParts = useMemo(() => parseDateParts(draftFromDate), [draftFromDate]);
  const toParts = useMemo(() => parseDateParts(draftToDate), [draftToDate]);

  // Detect narrow viewport for stacked, scrollable panel layout
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Clear any pending debounce on unmount
  useEffect(
    () => () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    },
    [],
  );

  // Reset draft when external from/to change while the panel is closed
  // (avoids clobbering the draft mid-edit while the panel is open)
  useEffect(() => {
    if (!open) {
      setDraftFromDate(from ? toLocalDateString(new Date(from)) : toLocalDateString(yesterday));
      setDraftToDate(to ? toLocalDateString(new Date(to)) : toLocalDateString(today));
      setDraftFromTime(from ? toLocalTimeString(new Date(from)) : "00:00");
      setDraftToTime(to ? toLocalTimeString(new Date(to)) : "23:59");
    }
  }, [from, to, open, today, yesterday]);

  /**
   * Auto-apply: debounce 300ms after any control change, then emit ISO
   * strings. If To would be <= From, bump To to From + 1 hour.
   */
  const scheduleApply = useCallback(
    (nextFromDate: string, nextToDate: string, nextFromTime: string, nextToTime: string) => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        const sameDay = nextFromDate === nextToDate;
        const fromDate = new Date(`${nextFromDate}T${sameDay && nextFromTime ? nextFromTime : "00:00"}`);
        const toDate = new Date(`${nextToDate}T${sameDay && nextToTime ? nextToTime : "23:59"}`);
        if (toDate.getTime() <= fromDate.getTime()) {
          toDate.setTime(fromDate.getTime() + 3600000);
        }
        onChange(fromDate.toISOString(), toDate.toISOString());
      }, 300);
    },
    [onChange],
  );

  const handleReset = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    onChange(null, null);
    setOpen(false);
  }, [onChange]);

  // Handlers for From date parts
  const handleFromDay = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (isNaN(val)) return;
      const next = buildDateString(val, fromParts.month, fromParts.year);
      setDraftFromDate(next);
      scheduleApply(next, draftToDate, draftFromTime, draftToTime);
    },
    [fromParts, draftToDate, draftFromTime, draftToTime, scheduleApply],
  );

  const handleFromMonth = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const m = parseInt(e.target.value, 10);
      const next = buildDateString(fromParts.day, m, fromParts.year);
      setDraftFromDate(next);
      scheduleApply(next, draftToDate, draftFromTime, draftToTime);
    },
    [fromParts, draftToDate, draftFromTime, draftToTime, scheduleApply],
  );

  const handleFromYear = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const y = parseInt(e.target.value, 10);
      const next = buildDateString(fromParts.day, fromParts.month, y);
      setDraftFromDate(next);
      scheduleApply(next, draftToDate, draftFromTime, draftToTime);
    },
    [fromParts, draftToDate, draftFromTime, draftToTime, scheduleApply],
  );

  // Handlers for To date parts
  const handleToDay = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (isNaN(val)) return;
      const next = buildDateString(val, toParts.month, toParts.year);
      setDraftToDate(next);
      scheduleApply(draftFromDate, next, draftFromTime, draftToTime);
    },
    [toParts, draftFromDate, draftFromTime, draftToTime, scheduleApply],
  );

  const handleToMonth = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const m = parseInt(e.target.value, 10);
      const next = buildDateString(toParts.day, m, toParts.year);
      setDraftToDate(next);
      scheduleApply(draftFromDate, next, draftFromTime, draftToTime);
    },
    [toParts, draftFromDate, draftFromTime, draftToTime, scheduleApply],
  );

  const handleToYear = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const y = parseInt(e.target.value, 10);
      const next = buildDateString(toParts.day, toParts.month, y);
      setDraftToDate(next);
      scheduleApply(draftFromDate, next, draftFromTime, draftToTime);
    },
    [toParts, draftFromDate, draftFromTime, draftToTime, scheduleApply],
  );

  // Handlers for time parts (only rendered on same-day ranges)
  const handleFromTime = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const t = e.target.value;
      setDraftFromTime(t);
      scheduleApply(draftFromDate, draftToDate, t, draftToTime);
    },
    [draftFromDate, draftToDate, draftToTime, scheduleApply],
  );

  const handleToTime = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const t = e.target.value;
      setDraftToTime(t);
      scheduleApply(draftFromDate, draftToDate, draftFromTime, t);
    },
    [draftFromDate, draftToDate, draftFromTime, scheduleApply],
  );

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

  // Renders one From/To day-month-year row
  const renderDateRow = (
    rowLabel: string,
    parts: { day: number; month: number; year: number },
    onDay: (e: React.ChangeEvent<HTMLInputElement>) => void,
    onMonth: (e: React.ChangeEvent<HTMLSelectElement>) => void,
    onYear: (e: React.ChangeEvent<HTMLSelectElement>) => void,
  ) => (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
        {rowLabel}
      </span>
      <div className="flex items-center gap-1.5">
        {/* Day */}
        <input
          type="number"
          min={1}
          max={31}
          value={parts.day}
          onChange={onDay}
          className={cn(controlBtnClass, "w-14 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none")}
          aria-label={`${rowLabel} day`}
        />
        {/* Month */}
        <select
          value={parts.month}
          onChange={onMonth}
          className={cn(controlBtnClass, "w-28")}
          aria-label={`${rowLabel} month`}
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
          aria-label={`${rowLabel} year`}
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  // The picker panel (date rows + optional same-day time inputs). Rendered in a
  // floating popover on desktop, a bottom sheet on mobile — never pushes content.
  const panel = (
    <>
      <div
        className={cn(
          "flex gap-4",
          isMobile ? "flex-col" : "flex-row flex-wrap",
        )}
      >
        {renderDateRow(
          "From",
          fromParts,
          handleFromDay,
          handleFromMonth,
          handleFromYear,
        )}
        {renderDateRow(
          "To",
          toParts,
          handleToDay,
          handleToMonth,
          handleToYear,
        )}
      </div>

      {showTime && (
        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              <Clock size={11} className="text-gray-400" />
              From time
            </label>
            <input
              type="time"
              value={draftFromTime}
              onChange={handleFromTime}
              className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]"
              aria-label="From time"
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
              onChange={handleToTime}
              className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]"
              aria-label="To time"
            />
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={controlBtnClass}
            aria-label={`Time range: ${label}`}
          >
            <CalendarDays
              size={13}
              className="text-gray-500 dark:text-gray-300 shrink-0"
            />
            <span>{label}</span>
            <ChevronDown
              size={12}
              className={cn(
                "text-gray-400 dark:text-gray-500 transition-transform duration-150",
                open && "rotate-180",
              )}
            />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          {isMobile ? (
            <div className="fixed inset-0 z-50 flex flex-col justify-end">
              <div
                className="absolute inset-0 bg-black/20"
                onClick={() => setOpen(false)}
              />
              <div className="relative bg-white dark:bg-gray-800 rounded-t-xl border-x border-t border-gray-100 dark:border-gray-700 shadow-overlay p-4 w-full max-h-[85vh] overflow-y-auto animate-sheetIn">
                {panel}
              </div>
            </div>
          ) : (
            <Popover.Content
              align="end"
              sideOffset={6}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-overlay p-3.5 z-50 w-max max-w-[calc(100vw-2rem)] animate-popoverIn"
            >
              {panel}
            </Popover.Content>
          )}
        </Popover.Portal>
      </Popover.Root>

      {hasRange && (
        <button
          type="button"
          aria-label="Reset time range"
          onClick={handleReset}
          className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
        >
          <X size={10} />
          Reset
        </button>
      )}
    </div>
  );
}
