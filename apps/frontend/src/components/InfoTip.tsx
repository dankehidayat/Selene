// apps/frontend/src/components/InfoTip.tsx
/**
 * Info icon: hover to open on fine pointers (desktop), tap/click on touch/mobile.
 * Shared by Power Overview estimate notes and Analytics fuzzy headers.
 */
import { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Info } from "lucide-react";

function useFinePointer(): boolean {
  const [fine, setFine] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setFine(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return fine;
}

export function InfoTip({
  title,
  content,
  side = "top",
  className = "",
  iconSize = 13,
}: {
  title: string;
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  iconSize?: number;
}) {
  const finePointer = useFinePointer();
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center rounded-full p-0.5 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${className}`}
          aria-label={title}
          onClick={(e) => {
            // On touch devices Popover handles toggle via onOpenChange.
            // Prevent double-toggle quirks when also using hover handlers.
            if (!finePointer) {
              e.stopPropagation();
            }
          }}
          onMouseEnter={() => {
            if (finePointer) setOpen(true);
          }}
          onMouseLeave={() => {
            if (finePointer) setOpen(false);
          }}
          onFocus={() => {
            if (finePointer) setOpen(true);
          }}
          onBlur={() => {
            if (finePointer) setOpen(false);
          }}
        >
          <Info size={iconSize} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          sideOffset={8}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onMouseEnter={() => {
            if (finePointer) setOpen(true);
          }}
          onMouseLeave={() => {
            if (finePointer) setOpen(false);
          }}
          className="z-50 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-4 outline-none animate-fadeScaleIn origin-[var(--radix-popover-content-transform-origin)]"
        >
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
            {title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {content}
          </p>
          <Popover.Arrow className="fill-white dark:fill-gray-800" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
