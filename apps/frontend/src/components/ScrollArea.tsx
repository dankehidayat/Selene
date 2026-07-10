import { type ReactNode } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

export function ScrollArea({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ScrollAreaPrimitive.Root className={cn("overflow-hidden", className)}>
      <ScrollAreaPrimitive.Viewport className="w-full h-full">{children}</ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="horizontal"
        className="flex h-2 touch-none select-none bg-gray-50 rounded-full mt-1"
      >
        <ScrollAreaPrimitive.Thumb className="flex-1 bg-gray-300 rounded-full" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}
