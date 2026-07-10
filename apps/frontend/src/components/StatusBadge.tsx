// [apps/frontend] src/components/StatusBadge.tsx
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const tone: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-600",
  Inactive: "bg-red-50 text-red-600",
  Safe: "bg-emerald-50 text-emerald-600",
  Warning: "bg-amber-50 text-amber-600",
  Critical: "bg-red-50 text-red-600",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "text-xs font-medium px-2 py-1 rounded-full",
        tone[status] || "bg-gray-50 text-gray-600",
        className,
      )}
    >
      {status}
    </span>
  );
}
