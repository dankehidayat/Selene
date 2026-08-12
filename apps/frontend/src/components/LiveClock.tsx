// apps/frontend/src/components/LiveClock.tsx
import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";

const JAKARTA_TZ = "Asia/Jakarta";

/** Rotating dashboard taglines, stable per calendar day. */
const GREETING_MESSAGES = [
  "Review today's energy patterns and plan for tomorrow.",
  "Start your day with insights into your energy usage.",
  "Monitor power consumption and environmental conditions.",
  "A calm dashboard for a clearer view of your fleet.",
  "Small watts add up. See where the day is going.",
  "Track the grid, the room, and the story between them.",
  "Live readings when you need them; history when you dig deeper.",
  "Keep an eye on peaks, comfort, and quiet efficiency.",
  "Your sensors are talking. Here's the plain-language summary.",
  "Steady power and comfortable air: today's twin goals.",
  "Glance at the numbers, then decide what needs attention.",
  "From Jakarta nights to office afternoons, one place to check in.",
  "Efficiency is a habit; this page helps you keep it.",
  "When the load spikes, you'll see it here first.",
  "Climate and current on the same stage. Take a seat.",
  "Plan the next shift with yesterday's peaks still in mind.",
  "Good data, fewer surprises. Welcome back.",
  "A quiet pulse of telemetry so you don't have to guess.",
  "Tune the room, respect the grid, enjoy the clarity.",
  "Every chart is a conversation with your building.",
  "Fresh metrics for a focused hour of work.",
  "Watch frequency stay on beat and comfort stay kind.",
  "Energy is a budget. Spend it where it matters.",
  "The moon watches overnight; Selene keeps the lights honest.",
  "Open the day with voltage, close it with a clear summary.",
  "Insights first, deep analytics when you're ready.",
  "Healthy loads make for healthier offices.",
  "See the pattern before it becomes a problem.",
  "One dashboard, many sensors, zero drama (hopefully).",
  "Stay curious about the watts behind the work.",
] as const;

function getGreetingMessage(): string {
  const day = Math.floor(Date.now() / 86_400_000);
  return GREETING_MESSAGES[day % GREETING_MESSAGES.length];
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatClock(date: Date, timeZone?: string): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  });
}

function formatClockDate(date: Date, timeZone?: string): string {
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(timeZone ? { timeZone } : {}),
  });
}

function useNow(tickMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);
  return now;
}

export function LiveClock({ userName }: { userName?: string }) {
  const nowClock = useNow(1000);
  const tagline = useMemo(() => getGreetingMessage(), []);

  const localTz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "Local";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          {getGreeting()}
          {userName ? `, ${userName.split(" ")[0]}` : ""} 👋
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {tagline}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end shrink-0">
        <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white/70 dark:bg-gray-900/50 px-3 py-2">
          <Clock size={14} className="text-blue-500 shrink-0" />
          <div className="leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Your time
            </p>
            <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
              {formatClock(nowClock)}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {formatClockDate(nowClock)}
              {localTz ? ` · ${localTz}` : ""}
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white/70 dark:bg-gray-900/50 px-3 py-2">
          <Clock size={14} className="text-violet-500 shrink-0" />
          <div className="leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Jakarta (WIB)
            </p>
            <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
              {formatClock(nowClock, JAKARTA_TZ)}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {formatClockDate(nowClock, JAKARTA_TZ)} · WIB (UTC+7)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}