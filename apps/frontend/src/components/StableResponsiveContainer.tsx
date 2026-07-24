// apps/frontend/src/components/StableResponsiveContainer.tsx
/**
 * Drop-in for recharts ResponsiveContainer: freezes measured size while the
 * desktop sidebar animates so Analytics doesn't reflow every frame.
 */
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { useShellLayout } from "@/lib/shellLayout";

type Props = {
  width?: string | number;
  height?: string | number;
  minWidth?: number;
  minHeight?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export function StableResponsiveContainer({
  width = "100%",
  height = "100%",
  minWidth = 0,
  minHeight = 0,
  className,
  style,
  children,
}: Props) {
  const { isResizing } = useShellLayout();
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const numericHeight = typeof height === "number" ? height : null;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(minWidth, Math.floor(rect.width));
      const h = numericHeight ?? Math.max(minHeight, Math.floor(rect.height));
      setSize((prev) =>
        prev.width === w && prev.height === h ? prev : { width: w, height: h },
      );
    };

    measure();

    const ro = new ResizeObserver(() => {
      if (document.documentElement.classList.contains("sidebar-resizing")) {
        return;
      }
      measure();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [numericHeight, minHeight, minWidth]);

  useEffect(() => {
    if (isResizing) return;
    const el = hostRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const w = Math.max(minWidth, Math.floor(rect.width));
    const h =
      numericHeight ??
      Math.max(minHeight, Math.floor(rect.height) || size.height);
    if (w > 0) setSize({ width: w, height: h || size.height || 300 });
  }, [isResizing, numericHeight, minHeight, minWidth]);

  const chartH = numericHeight ?? (size.height || 300);
  const chartW = size.width;

  let child: ReactNode = null;
  if (chartW > 0) {
    const only = Children.only(children);
    if (isValidElement(only)) {
      child = cloneElement(
        only as ReactElement<{ width?: number; height?: number }>,
        { width: chartW, height: chartH },
      );
    } else {
      child = children;
    }
  }

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        width,
        height: numericHeight ?? height,
        minWidth,
        minHeight: numericHeight ?? minHeight,
        position: "relative",
        ...style,
      }}
    >
      {child}
    </div>
  );
}
