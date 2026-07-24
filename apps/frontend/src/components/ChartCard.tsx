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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <div className="flex items-center gap-2">
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

export function RangeSelect({
  options,
  value,
  onChange,
  labels,
}: RangeSelectProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition outline-none">
          {labels?.[value] ?? value} <ChevronDown size={13} />
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
