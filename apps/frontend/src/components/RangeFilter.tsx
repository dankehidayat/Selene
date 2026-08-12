import { useState, useCallback, useEffect, useMemo } from "react";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { controlBtnClass } from "./ChartCard";
import { cn } from "@/lib/utils";

interface RangeFilterProps {
  /** ISO string or null for default 24h */
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Date/time range filter: "From" and "To" calendar pickers with conditional
 * time pickers when both dates match. Defaults to 24h window.
 *
 * Two mini month-calendars (From | To) with prev/next navigation; selecting a
 * day fills the date. When From and To fall on the same day, native time
 * inputs appear (color-scheme aware so the clock icon renders correctly in
 * dark mode).
 */
export function RangeFilter({ from, to, onChange }: RangeFilterProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Draft state: date parts as "YYYY-MM-DD", time parts as "HH:MM"
  const [draftFromDate, setDraftFromDate] = useState(() =>
    from ? toLocalDateString(new Date(from)) : toLocalDateString(shiftDays(today, -1)),
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

  const sameDate = draftFromDate === draftToDate;

  // Reset draft when external from/to change while closed
  useEffect(() => {
    if (!open) {
      setDraftFromDate(from ? toLocalDateString(new Date(from)) : toLocalDateString(shiftDays(today, -1)));
      setDraftToDate(to ? toLocalDateString(new Date(to)) : toLocalDateString(today));
      setDraftFromTime(from ? toLocalTimeString(new Date(from)) : "00:00");
      setDraftToTime(to ? toLocalTimeString(new Date(to)) : "23:59");
    }
  }, [from, to, open, today]);

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

  const label = from && to
    ? `${formatShortDate(new Date(from))} – ${formatShortDate(new Date(to))}`
    : "24 Hours";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={controlBtnClass}>
          <CalendarDays size={13} className="text-gray-500 dark:text-gray-300" />
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg p-4 z-50 w-[540px] max-w-[calc(100vw-2rem)]"
        >
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CalendarPicker
              label="From"
              date={draftFromDate}
              onChange={setDraftFromDate}
              min={undefined}
              max={draftToDate}
            />
            <CalendarPicker
              label="To"
              date={draftToDate}
              onChange={setDraftToDate}
              min={draftFromDate}
              max={undefined}
            />
          </div>

          {sameDate && (
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
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
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
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

          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
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
              Reset (24h)
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ------------------------------------------------------------------ */
/* Mini month calendar                                                 */
/* ------------------------------------------------------------------ */

interface CalendarPickerProps {
  label: string;
  date: string; // YYYY-MM-DD or ""
  onChange: (d: string) => void;
  min?: string;
  max?: string;
}

function CalendarPicker({ label, date, onChange, min, max }: CalendarPickerProps) {
  const selected = date ? parseLocalDate(date) : null;
  const [view, setView] = useState(() =>
    selected ? new Date(selected.getFullYear(), selected.getMonth(), 1) : startOfMonth(new Date()),
  );

  const minDate = min ? parseLocalDate(min) : undefined;
  const maxDate = max ? parseLocalDate(max) : undefined;

  const year = view.getFullYear();
  const month = view.getMonth();

  const cells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: (Date | null)[] = [];
    for (let i = 0; i < firstDow; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(new Date(year, month, d));
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [year, month]);

  const prevDisabled =
    minDate && new Date(year, month - 1, 1) < startOfMonth(minDate);
  const nextDisabled =
    maxDate && new Date(year, month + 1, 1) > startOfMonth(maxDate);

  const isSelected = (d: Date) =>
    selected && sameDay(d, selected);
  const isToday = (d: Date) => sameDay(d, new Date());
  const isOutOfRange = (d: Date) =>
    (minDate && d < minDate) || (maxDate && d > maxDate);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
          {label}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setView(new Date(year, month - 1, 1))}
            disabled={!!prevDisabled}
            className="h-6 w-6 flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition"
            aria-label="Previous month"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200 min-w-[92px] text-center">
            {MONTHS[month]} {year}
          </span>
          <button
            type="button"
            onClick={() => setView(new Date(year, month + 1, 1))}
            disabled={!!nextDisabled}
            className="h-6 w-6 flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition"
            aria-label="Next month"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((w) => (
          <span
            key={w}
            className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 py-1"
          >
            {w}
          </span>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button
              key={d.toISOString()}
              type="button"
              disabled={isOutOfRange(d)}
              onClick={() => onChange(toLocalDateString(d))}
              className={cn(
                "h-7 text-xs rounded-lg transition flex items-center justify-center",
                isSelected(d)
                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                  : isToday(d)
                    ? "text-blue-600 dark:text-blue-400 font-semibold ring-1 ring-inset ring-blue-300 dark:ring-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700",
                isOutOfRange(d) && "text-gray-300 dark:text-gray-600 cursor-not-allowed",
              )}
            >
              {d.getDate()}
            </button>
          ) : (
            <span key={`e-${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Date helpers (local-time safe)                                      */
/* ------------------------------------------------------------------ */

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function shiftDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toLocalTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
