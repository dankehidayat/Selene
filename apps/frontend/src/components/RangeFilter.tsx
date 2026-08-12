import { useState, useCallback, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, X } from "lucide-react";
import { controlBtnClass } from "./ChartCard";

interface RangeFilterProps {
  /** ISO string or null for default 24h */
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
}

/**
 * Date/time range filter: "From" and "To" date pickers with conditional
 * time pickers when both dates match. Defaults to 24h window.
 */
export function RangeFilter({ from, to, onChange }: RangeFilterProps) {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);

  // Internal draft state — local date/time strings in YYYY-MM-DD / HH:MM
  const defaultFromDate = from
    ? toLocalDateString(new Date(from))
    : toLocalDateString(yesterday);
  const defaultToDate = to
    ? toLocalDateString(new Date(to))
    : toLocalDateString(today);
  const defaultFromTime = from
    ? toLocalTimeString(new Date(from))
    : toLocalTimeString(yesterday);
  const defaultToTime = to
    ? toLocalTimeString(new Date(to))
    : toLocalTimeString(today);

  const [draftFromDate, setDraftFromDate] = useState(defaultFromDate);
  const [draftToDate, setDraftToDate] = useState(defaultToDate);
  const [draftFromTime, setDraftFromTime] = useState(defaultFromTime);
  const [draftToTime, setDraftToTime] = useState(defaultToTime);
  const [open, setOpen] = useState(false);

  const sameDate = draftFromDate === draftToDate;

  // Reset draft when external from/to change
  useEffect(() => {
    if (!open) {
      setDraftFromDate(from ? toLocalDateString(new Date(from)) : toLocalDateString(yesterday));
      setDraftToDate(to ? toLocalDateString(new Date(to)) : toLocalDateString(today));
      setDraftFromTime(from ? toLocalTimeString(new Date(from)) : toLocalTimeString(yesterday));
      setDraftToTime(to ? toLocalTimeString(new Date(to)) : toLocalTimeString(today));
    }
  }, [from, to, open, yesterday, today]);

  const handleApply = useCallback(() => {
    const fromDate = new Date(`${draftFromDate}T${sameDate ? draftFromTime : "00:00"}`);
    const toDate = new Date(`${draftToDate}T${sameDate ? draftToTime : "23:59"}`);
    // Ensure to is after from — default to +1h if same
    if (toDate <= fromDate) toDate.setTime(fromDate.getTime() + 3600000);
    onChange(fromDate.toISOString(), toDate.toISOString());
    setOpen(false);
  }, [draftFromDate, draftToDate, draftFromTime, draftToTime, sameDate, onChange]);

  const handleReset = useCallback(() => {
    onChange(null, null);
    setOpen(false);
  }, [onChange]);

  const label = from && to
    ? `${new Date(from).toLocaleDateString()} – ${new Date(to).toLocaleDateString()}`
    : "24 Hours";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={controlBtnClass}>
          <CalendarDays size={13} />
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg p-4 z-50 min-w-[250px] space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time Range</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X size={14} />
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">From</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={draftFromDate}
                onChange={(e) => setDraftFromDate(e.target.value)}
                className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
              {sameDate && (
                <input
                  type="time"
                  value={draftFromTime}
                  onChange={(e) => setDraftFromTime(e.target.value)}
                  className="w-24 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">To</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={draftToDate}
                onChange={(e) => setDraftToDate(e.target.value)}
                className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
              {sameDate && (
                <input
                  type="time"
                  value={draftToTime}
                  onChange={(e) => setDraftToTime(e.target.value)}
                  className="w-24 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
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

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toLocalTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}