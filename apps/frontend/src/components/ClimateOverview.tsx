// apps/frontend/src/components/ClimateOverview.tsx
import { Thermometer, Droplets } from "lucide-react";

interface ClimateOverviewProps {
  temperature: number | undefined;
  humidity: number | undefined;
  comfort: string | undefined;
}

/** Map comfort band → 0–100 for the level slider (Cold → Hot). */
function comfortLevel(c: string | undefined): number | undefined {
  if (!c) return undefined;
  switch (c.toUpperCase()) {
    case "COLD":
      return 10;
    case "COOL":
      return 30;
    case "COMFORTABLE":
      return 50;
    case "WARM":
      return 72;
    case "HOT":
      return 92;
    default:
      return undefined;
  }
}

function getComfortColor(c: string | undefined): string {
  if (!c) return "text-gray-400 dark:text-gray-500";
  switch (c.toUpperCase()) {
    case "COLD":
      return "text-blue-600 dark:text-blue-400";
    case "COOL":
      return "text-cyan-600 dark:text-cyan-400";
    case "COMFORTABLE":
      return "text-emerald-600 dark:text-emerald-400";
    case "WARM":
      return "text-amber-600 dark:text-amber-400";
    case "HOT":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-gray-400 dark:text-gray-500";
  }
}

function comfortBarColor(c: string | undefined): string {
  if (!c) return "bg-gray-300 dark:bg-gray-600";
  switch (c.toUpperCase()) {
    case "COLD":
      return "bg-blue-500";
    case "COOL":
      return "bg-cyan-500";
    case "COMFORTABLE":
      return "bg-emerald-500";
    case "WARM":
      return "bg-amber-500";
    case "HOT":
      return "bg-red-500";
    default:
      return "bg-gray-300 dark:bg-gray-600";
  }
}

function prettyComfort(c: string | undefined): string {
  if (!c) return "—";
  return c.charAt(0) + c.slice(1).toLowerCase();
}

function comfortHeadline(c: string | undefined): string {
  if (!c) return "Climate status unknown";
  switch (c.toUpperCase()) {
    case "COLD":
      return "Room mood: chilly";
    case "COOL":
      return "Room mood: pleasantly cool";
    case "COMFORTABLE":
      return "Room mood: just right";
    case "WARM":
      return "Room mood: a touch warm";
    case "HOT":
      return "Room mood: tropical drama";
    default:
      return "Room mood: mysterious";
  }
}

function climateNarration(
  temperature: number | undefined,
  humidity: number | undefined,
  comfort: string | undefined,
): string {
  if (temperature === undefined && humidity === undefined) {
    return "The climate sensors are quiet right now. When temperature and humidity report in, we'll paint the full room story.";
  }

  const t =
    temperature !== undefined ? `${temperature.toFixed(1)}°C` : "unknown temp";
  const h =
    humidity !== undefined ? `${humidity.toFixed(0)}% humidity` : "unknown humidity";

  let core = "";
  switch ((comfort || "").toUpperCase()) {
    case "COLD":
      core = `It's a sweater day in here at ${t} with ${h}. Fingers might prefer a heater — or a hot coffee.`;
      break;
    case "COOL":
      core = `Crisp and workable: ${t}, ${h}. A little cool, still friendly for focus and long coding sessions.`;
      break;
    case "COMFORTABLE":
      core = `Goldilocks zone unlocked — ${t} and ${h}. The kind of air that lets you forget the HVAC and get stuff done.`;
      break;
    case "WARM":
      core = `Things are heating up: ${t} with ${h}. A window crack or a fan cameo would be a good plot twist.`;
      break;
    case "HOT":
      core = `It's properly hot — ${t}, ${h}. Cooling is the hero of this episode; productivity is the damsel.`;
      break;
    default:
      core = `Current snapshot: ${t}, ${h}. Comfort band hasn't classified yet — still a fine day for sensors.`;
  }

  if (humidity !== undefined) {
    if (humidity > 70) {
      core += " Air is on the muggy side.";
    } else if (humidity < 40) {
      core += " Air is a bit dry — plants and sinuses take note.";
    }
  }

  return core;
}

function MetricStory({
  icon: Icon,
  iconClass,
  label,
  story,
}: {
  icon: typeof Thermometer;
  iconClass: string;
  label: string;
  story: string;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <Icon size={20} className={`shrink-0 mt-0.5 ${iconClass}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {label}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
          {story}
        </p>
      </div>
    </div>
  );
}

export function ClimateOverview({
  temperature,
  humidity,
  comfort,
}: ClimateOverviewProps) {
  const level = comfortLevel(comfort);
  const barWidth = level != null ? level : 0;

  const tempStory =
    temperature === undefined
      ? "Thermometer is still calibrating its monologue. No temperature reading yet."
      : `It's ${temperature.toFixed(1)}°C in the room — ${
          temperature < 20
            ? "cool enough to keep you alert"
            : temperature < 26
              ? "a comfortable indoor band for most people"
              : temperature < 30
                ? "warming up; short sleeves preferred"
                : "decidedly warm for desk work"
        }.`;

  const humStory =
    humidity === undefined
      ? "Humidity is camera-shy at the moment — no sample yet."
      : humidity > 70
        ? `Humidity is ${humidity.toFixed(0)}% — muggy territory. It can feel stickier than the thermometer alone suggests.`
        : humidity < 40
          ? `Humidity is ${humidity.toFixed(0)}% — on the dry side. A humidifier (or a houseplant army) could help.`
          : `Humidity is ${humidity.toFixed(0)}% — a comfortable middle ground that rarely steals the show.`;

  return (
    <div className="space-y-4 mt-1">
      {/* Comfort level hero + slider */}
      <div>
        <p className={`text-2xl font-semibold tracking-tight ${getComfortColor(comfort)}`}>
          {prettyComfort(comfort)}
        </p>

        {/* Gradient track with level indicator (Cold ← → Hot) */}
        <div className="mt-3 relative">
          <div
            className="h-1.5 rounded-full overflow-hidden bg-gradient-to-r from-blue-400 via-emerald-400 to-red-400 opacity-40 dark:opacity-30"
            aria-hidden
          />
          <div
            className="absolute inset-0 h-1.5 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={level ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Comfort level from cold to hot"
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${comfortBarColor(comfort)}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            <span>Cold</span>
            <span>Comfort</span>
            <span>Hot</span>
          </div>
        </div>

        <p className={`text-sm font-semibold mt-2.5 ${getComfortColor(comfort)}`}>
          {comfortHeadline(comfort)}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed">
          {climateNarration(temperature, humidity, comfort)}
        </p>
      </div>

      <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-4">
        <MetricStory
          icon={Thermometer}
          iconClass="text-rose-500"
          label="Temperature"
          story={tempStory}
        />
        <MetricStory
          icon={Droplets}
          iconClass="text-blue-500"
          label="Humidity"
          story={humStory}
        />
      </div>
    </div>
  );
}
