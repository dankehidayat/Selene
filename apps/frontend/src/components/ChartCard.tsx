// apps/frontend/src/components/ChartCard.tsx
import { type ReactNode, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Download, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** High-DPI capture of a chart card (includes title + plot). */
async function captureCard(el: HTMLElement, dark: boolean): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");
  // Recharts/SVG benefit from high scale; clamp for memory
  const scale = Math.min(4, Math.max(2.5, (window.devicePixelRatio || 1) * 2.5));
  const w = Math.max(el.scrollWidth, el.offsetWidth);
  const h = Math.max(el.scrollHeight, el.offsetHeight);

  return html2canvas(el, {
    backgroundColor: dark ? "#111827" : "#ffffff",
    scale,
    useCORS: true,
    allowTaint: true,
    logging: false,
    // Prefer accurate SVG paint over foreignObject (often blurry)
    foreignObjectRendering: false,
    width: w,
    height: h,
    windowWidth: w,
    windowHeight: h,
    x: 0,
    y: 0,
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    onclone: (_doc, cloned) => {
      cloned.style.width = `${w}px`;
      cloned.style.height = `${h}px`;
      cloned.style.transform = "none";
      // Force opaque backgrounds so dark mode exports cleanly
      cloned.querySelectorAll("svg").forEach((svg) => {
        (svg as SVGElement).style.overflow = "visible";
      });
    },
  });
}

function isDarkMode() {
  return document.documentElement.classList.contains("dark");
}

export function ChartCard({
  title,
  action,
  children,
  className,
  chartId,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  chartId?: string;
}) {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const captureTarget = () => {
    // Prefer whole card (title + chrome) for a “embedded” look
    if (cardRef.current) return cardRef.current;
    if (chartId) return document.getElementById(chartId);
    return null;
  };

  const handleDownloadPNG = async () => {
    const el = captureTarget();
    if (!el) return;
    const canvas = await captureCard(el, isDarkMode());
    const link = document.createElement("a");
    link.download = `${title.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL("image/png", 1.0);
    link.click();
  };

  const handleCopy = async () => {
    const el = captureTarget();
    if (!el) return;
    const canvas = await captureCard(el, isDarkMode());
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          const link = document.createElement("a");
          link.download = `${title.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.png`;
          link.href = canvas.toDataURL("image/png", 1.0);
          link.click();
        }
      },
      "image/png",
      1.0,
    );
  };

  return (
    <div
      ref={cardRef}
      id={chartId}
      className={cn(
        "bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-4">
        <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">
          {action}
          {chartId && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition outline-none">
                  <Download size={13} />
                  <ChevronDown size={10} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg py-1 min-w-[11rem] z-50"
                >
                  <DropdownMenu.Item
                    onSelect={(e) => {
                      e.preventDefault();
                      void handleDownloadPNG();
                    }}
                    className="flex items-center gap-2.5 text-sm px-3 py-2.5 cursor-pointer outline-none rounded-lg mx-1 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    <Download size={13} className="text-gray-400" /> Download
                    PNG
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={(e) => {
                      e.preventDefault();
                      void handleCopy();
                    }}
                    className="flex items-center gap-2.5 text-sm px-3 py-2.5 cursor-pointer outline-none rounded-lg mx-1 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    {copied ? (
                      <Check size={13} className="text-emerald-500" />
                    ) : (
                      <Copy size={13} className="text-gray-400" />
                    )}
                    {copied ? "Copied!" : "Copy to clipboard"}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

interface RangeSelectProps {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  labels?: Record<string, string>;
}

/**
 * Soft control chrome — inset ring instead of a heavy black outline so
 * Forecast / Range sit lightly on the card header.
 */
export const controlBtnClass =
  "inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-50/90 dark:bg-gray-800/70 ring-1 ring-inset ring-gray-200/90 dark:ring-gray-700/90 rounded-lg px-2.5 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700/80 active:scale-[0.98] transition outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50";

export const controlBtnActiveClass =
  "inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 transition outline-none active:scale-[0.98] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/45 ring-1 ring-inset ring-blue-200/80 dark:ring-blue-800/50 focus-visible:ring-2 focus-visible:ring-blue-400/50";

/** Readable confidence chip for chart toolbars. */
export function ConfidencePill({ percent }: { percent: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-800/90 ring-1 ring-inset ring-gray-200/80 dark:ring-gray-700/80 rounded-lg px-2.5 py-1.5"
      title="Ensemble forecast confidence"
    >
      {Math.round(percent)}%
      <span className="font-semibold text-gray-600 dark:text-gray-300">
        conf.
      </span>
    </span>
  );
}

/** Compact visual key for solid vs dashed series (replaces text banner). */
export function ForecastLegendHint() {
  return (
    <div
      className="inline-flex items-center gap-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200"
      title="Solid lines are measured readings; dashed lines are predicted"
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="w-4 h-0 border-t-2 border-solid border-gray-700 dark:border-gray-200"
        />
        Actual
      </span>
      <span className="text-gray-300 dark:text-gray-600 font-normal">·</span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="w-4 h-0 border-t-2 border-dashed border-blue-500 dark:border-blue-400"
        />
        Predicted
      </span>
    </div>
  );
}

export function RangeSelect({
  options,
  value,
  onChange,
  labels,
}: RangeSelectProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className={controlBtnClass}>
          {labels?.[value] ?? value}{" "}
          <ChevronDown size={13} className="text-gray-500 dark:text-gray-400" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg py-1 min-w-[9rem] z-50"
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option}
              onSelect={() => onChange(option)}
              className={cn(
                "text-sm px-3 py-2 cursor-pointer outline-none transition rounded-lg mx-1",
                option === value
                  ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700",
              )}
            >
              {labels?.[option] ?? option}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Pressable control matching RangeSelect (e.g. Forecast toggle). */
export function ToggleControl({
  pressed,
  onPressedChange,
  children,
  className,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(pressed ? controlBtnActiveClass : controlBtnClass, className)}
    >
      {children}
    </button>
  );
}
