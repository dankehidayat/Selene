// apps/frontend/src/lib/shellLayout.tsx
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const SIDEBAR_MS = 300;

type ShellLayoutContextValue = {
  sidebarOpen: boolean;
  /** True while sidebar/content width is animating — charts should freeze resize. */
  isResizing: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
};

const ShellLayoutContext = createContext<ShellLayoutContextValue>({
  sidebarOpen: true,
  isResizing: false,
  toggleSidebar: () => {},
  setSidebarOpen: () => {},
});

export function useShellLayout() {
  return useContext(ShellLayoutContext);
}

export function ShellLayoutProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpenState] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const timerRef = useRef<number | null>(null);

  const markResizing = useCallback(() => {
    setIsResizing(true);
    document.documentElement.classList.add("sidebar-resizing");
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setIsResizing(false);
      document.documentElement.classList.remove("sidebar-resizing");
      timerRef.current = null;
    }, SIDEBAR_MS + 40);
  }, []);

  const setSidebarOpen = useCallback(
    (open: boolean) => {
      markResizing();
      setSidebarOpenState(open);
    },
    [markResizing],
  );

  const toggleSidebar = useCallback(() => {
    markResizing();
    setSidebarOpenState((v) => !v);
  }, [markResizing]);

  const value = useMemo(
    () => ({ sidebarOpen, isResizing, toggleSidebar, setSidebarOpen }),
    [sidebarOpen, isResizing, toggleSidebar, setSidebarOpen],
  );

  return (
    <ShellLayoutContext.Provider value={value}>
      {children}
    </ShellLayoutContext.Provider>
  );
}

export const SHELL_SIDEBAR_W = 248;
export const SHELL_SIDEBAR_MS = SIDEBAR_MS;
