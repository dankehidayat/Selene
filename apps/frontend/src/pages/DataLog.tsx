// apps/frontend/src/pages/DataLog.tsx
import { useState, useRef } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import {
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { ChartCard } from "@/components/ChartCard";
import { useRecentReadings } from "@/services/api";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api";
const PAGE_SIZES = [10, 20, 30, 50, 100];

export function DataLog() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [jumpValue, setJumpValue] = useState("");
  const [jumpError, setJumpError] = useState("");
  const [jumpPopoverOpen, setJumpPopoverOpen] = useState(false);
  const jumpInputRef = useRef<HTMLInputElement>(null);

  const { data: allReadings = [], isLoading } = useRecentReadings(500);

  const sortedReadings = [...allReadings].sort((a, b) => {
    const da = new Date(a.timestamp).getTime();
    const db = new Date(b.timestamp).getTime();
    return sortOrder === "desc" ? db - da : da - db;
  });

  const totalRows = sortedReadings.length;
  const totalPages = Math.ceil(totalRows / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedReadings = sortedReadings.slice(
    startIndex,
    startIndex + pageSize,
  );

  const handleJump = () => {
    const num = parseInt(jumpValue, 10);
    if (isNaN(num) || num < 1 || num > totalPages) {
      setJumpError(`Enter 1–${totalPages}`);
      return;
    }
    setPage(num);
    setJumpValue("");
    setJumpError("");
    setJumpPopoverOpen(false);
  };

  const handlePopoverOpen = (open: boolean) => {
    setJumpPopoverOpen(open);
    if (open) {
      setJumpValue("");
      setJumpError("");
      setTimeout(() => jumpInputRef.current?.focus(), 50);
    }
  };

  const handleExport = async (format: "csv" | "tsv") => {
    setExportLoading(format);
    try {
      const res = await fetch(`${API_BASE}/readings/export?format=${format}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "tsv" ? "tsv" : "csv";
      a.download = `sensor-data-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExportLoading(null);
    }
  };

  const getPageNumbers = (): (number | "ellipsis")[] => {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "ellipsis")[] = [1];
    if (page > 3) pages.push("ellipsis");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Data Log
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Historical sensor readings
          </p>
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition outline-none">
              <Download size={14} /> Export <ChevronDown size={14} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg py-1 min-w-[11rem] z-50"
            >
              <DropdownMenu.Item
                onSelect={() => handleExport("csv")}
                disabled={exportLoading === "csv"}
                className="flex items-center gap-2.5 text-sm px-3 py-2.5 cursor-pointer outline-none rounded-lg mx-1 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <FileSpreadsheet size={14} />{" "}
                {exportLoading === "csv" ? "Downloading..." : "Download as CSV"}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => handleExport("tsv")}
                disabled={exportLoading === "tsv"}
                className="flex items-center gap-2.5 text-sm px-3 py-2.5 cursor-pointer outline-none rounded-lg mx-1 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <FileText size={14} />{" "}
                {exportLoading === "tsv" ? "Downloading..." : "Download as TSV"}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <ChartCard title="Sensor Readings">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            Loading...
          </div>
        ) : allReadings.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            No readings available
          </div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs border-b border-gray-100 dark:border-gray-800">
                    <th
                      className="font-semibold py-3 px-2 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition select-none whitespace-nowrap text-gray-900 dark:text-white"
                      onClick={() =>
                        setSortOrder(sortOrder === "desc" ? "asc" : "desc")
                      }
                    >
                      <span className="inline-flex items-center gap-1.5">
                        Timestamp <ArrowUpDown size={12} />
                      </span>
                    </th>
                    <th className="font-semibold py-3 px-2 text-gray-900 dark:text-white">
                      Voltage (V)
                    </th>
                    <th className="font-semibold py-3 px-2 text-gray-900 dark:text-white">
                      Current (A)
                    </th>
                    <th className="font-semibold py-3 px-2 text-gray-900 dark:text-white">
                      Power (W)
                    </th>
                    <th className="font-semibold py-3 px-2 text-gray-900 dark:text-white">
                      cos φ
                    </th>
                    <th className="font-semibold py-3 px-2 hidden md:table-cell text-gray-900 dark:text-white">
                      Temp (°C)
                    </th>
                    <th className="font-semibold py-3 px-2 hidden md:table-cell text-gray-900 dark:text-white">
                      Hum (%)
                    </th>
                    <th className="font-semibold py-3 px-2 text-gray-900 dark:text-white">
                      Freq (Hz)
                    </th>
                    <th className="font-semibold py-3 px-2 text-gray-900 dark:text-white">
                      Energy (kWh)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReadings.map((r, i) => (
                    <tr
                      key={r.timestamp + i}
                      className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-2 text-sm text-gray-600 dark:text-gray-400 tabular-nums whitespace-nowrap">
                        {new Date(r.timestamp).toLocaleString("id-ID", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 px-2 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                        {r.acVoltage.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-2 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                        {r.acCurrent.toFixed(3)}
                      </td>
                      <td className="py-2.5 px-2 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                        {r.acPower.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-2 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                        {r.cosPhi.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2 text-sm text-gray-600 dark:text-gray-400 tabular-nums hidden md:table-cell">
                        {r.temperature.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-2 text-sm text-gray-600 dark:text-gray-400 tabular-nums hidden md:table-cell">
                        {r.humidity.toFixed(0)}
                      </td>
                      <td className="py-2.5 px-2 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                        {r.frequency.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-2 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                        {r.totalEnergy.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
                <span>
                  {startIndex + 1}–{Math.min(startIndex + pageSize, totalRows)}{" "}
                  of {totalRows}
                </span>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className="flex items-center gap-1 px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 outline-none text-gray-700 dark:text-gray-300 font-medium">
                      {pageSize} <ChevronDown size={12} />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="start"
                      sideOffset={4}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg py-1 min-w-[4rem] z-50"
                    >
                      {PAGE_SIZES.map((size) => (
                        <DropdownMenu.Item
                          key={size}
                          onSelect={() => {
                            setPageSize(size);
                            setPage(1);
                          }}
                          className={`text-sm px-3 py-2 cursor-pointer outline-none rounded-lg mx-1 ${pageSize === size ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40" : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                        >
                          {size}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>

              <Popover.Root
                open={jumpPopoverOpen}
                onOpenChange={handlePopoverOpen}
              >
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {getPageNumbers().map((item, idx) => {
                    if (item === "ellipsis")
                      return (
                        <Popover.Trigger key={`ellipsis-${idx}`} asChild>
                          <button className="h-8 w-8 flex items-center justify-center text-sm rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                            ...
                          </button>
                        </Popover.Trigger>
                      );
                    return (
                      <button
                        key={item}
                        onClick={() => setPage(item)}
                        className={`h-8 w-8 flex items-center justify-center text-sm rounded-lg transition ${page === item ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                      >
                        {item}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <Popover.Portal>
                  <Popover.Content
                    align="center"
                    sideOffset={8}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg p-3 w-44 z-50"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <p className="text-xs text-gray-900 dark:text-white mb-2 font-medium">
                      Jump to page (1–{totalPages})
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleJump();
                      }}
                      className="flex gap-1.5"
                    >
                      <input
                        ref={jumpInputRef}
                        type="number"
                        min={1}
                        max={totalPages}
                        value={jumpValue}
                        onChange={(e) => {
                          setJumpValue(e.target.value);
                          setJumpError("");
                        }}
                        className="flex-1 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 outline-none focus:border-gray-400 transition"
                        placeholder={`1–${totalPages}`}
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-sm font-medium text-white dark:text-gray-900 bg-gray-900 dark:bg-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition"
                      >
                        Go
                      </button>
                    </form>
                    {jumpError && (
                      <p className="text-xs text-red-500 mt-1.5">{jumpError}</p>
                    )}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>
          </>
        )}
      </ChartCard>
    </div>
  );
}
