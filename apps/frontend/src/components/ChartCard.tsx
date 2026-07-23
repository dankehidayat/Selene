// apps/frontend/src/components/ChartCard.tsx
import { type ReactNode, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Download, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const handleDownloadPNG = async () => {
    if (!chartId) return;
    const el = document.getElementById(chartId);
    if (!el) return;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 3,
      useCORS: true,
      allowTaint: true,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    });
    const link = document.createElement("a");
    link.download = `${title.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleCopy = async () => {
    if (!chartId) return;
    const el = document.getElementById(chartId);
    if (!el) return;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 3,
      useCORS: true,
      allowTaint: true,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    });
    canvas.toBlob(async (blob) => {
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
        link.href = canvas.toDataURL("image/png");
        link.click();
      }
    });
  };

  return (
    <div
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
                    onSelect={handleDownloadPNG}
                    className="flex items-center gap-2.5 text-sm px-3 py-2.5 cursor-pointer outline-none rounded-lg mx-1 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    <Download size={13} className="text-gray-400" /> Download
                    PNG
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={handleCopy}
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
      {chartId ? <div id={chartId}>{children}</div> : children}
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
