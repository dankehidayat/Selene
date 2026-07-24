// apps/frontend/src/components/SettingsOverlay.tsx
import {
  useState,
  useEffect,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useAuth, useLoginHistory } from "@/services/auth";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  AlertCircle,
  Trash2,
  Monitor,
  Clock,
  X,
  ChevronLeft,
  User as UserIcon,
  Key,
  LogOut,
} from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "/api";

// ── Helpers ───────────────────────────────────────────────

function getBrowser(userAgent: string): string {
  if (!userAgent) return "Unknown";
  if (userAgent.includes("Edg")) return "Edge";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Safari")) return "Safari";
  return "Other";
}

function getOS(userAgent: string): string {
  if (!userAgent) return "";
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Mac")) return "macOS";
  if (userAgent.includes("Linux")) return "Linux";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS";
  return "";
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile;
}

// ── Sub-components ────────────────────────────────────────

function SettingsRow({
  label,
  value,
  action,
}: {
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 gap-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {label}
        </p>
        <div className="text-sm text-gray-900 dark:text-white mt-1">
          {value}
        </div>
      </div>
      {action && <div className="sm:ml-4">{action}</div>}
    </div>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
    >
      Edit
    </button>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1 mt-8 first:mt-0">
      {children}
    </h3>
  );
}

// ── Context ───────────────────────────────────────────────

interface SettingsContextType {
  openSettings: () => void;
  closeSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType>({
  openSettings: () => {},
  closeSettings: () => {},
});

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <SettingsContext.Provider
      value={{
        openSettings: () => setSettingsOpen(true),
        closeSettings: () => setSettingsOpen(false),
      }}
    >
      {children}
      <SettingsOverlay
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </SettingsContext.Provider>
  );
}

// ── Nav Items ─────────────────────────────────────────────

// Administration lives on /admin (Admin Tools) — not duplicated here.
const navItems = [
  { key: "general", label: "General", icon: UserIcon },
  { key: "security", label: "Login & Security", icon: Key },
] as const;

// ── Main Overlay Component ────────────────────────────────

interface SettingsOverlayProps {
  open: boolean;
  onClose: () => void;
}

function SettingsOverlay({ open, onClose }: SettingsOverlayProps) {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { history: loginHistory, loading: historyLoading } = useLoginHistory();
  const isMobile = useIsMobile();

  const [editing, setEditing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "security">("general");
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mobileView, setMobileView] = useState<"nav" | "content">("nav");

  const [name, setName] = useState(user?.name || "");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [newEmail, setNewEmail] = useState(user?.email || "");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsClosing(false);
      setMobileView("nav");
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (open) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(
      () => {
        setIsVisible(false);
        onClose();
      },
      isMobile ? 250 : 200,
    );
  };

  const handleLogout = () => {
    handleClose();
    setTimeout(() => {
      logout();
      navigate({ to: "/login" });
    }, 200);
  };

  const selectTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setEditing(null);
    if (isMobile) setMobileView("content");
  };

  const handleMobileBack = () => {
    setMobileView("nav");
    setEditing(null);
  };

  if (!isVisible && !open) return null;

  const handleEdit = (field: string) => {
    setEditing(field);
    if (field !== "name") setName(user?.name || "");
    if (field !== "email") {
      setNewEmail(user?.email || "");
      setEmailPassword("");
    }
    if (field !== "password") {
      setCurrentPassword("");
      setNewPassword("");
    }
    if (field !== "delete") {
      setDeleteConfirm("");
      setDeletePassword("");
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setName(user?.name || "");
    setNewEmail(user?.email || "");
    setEmailPassword("");
    setCurrentPassword("");
    setNewPassword("");
    setDeleteConfirm("");
    setDeletePassword("");
    setNameMsg(null);
    setEmailMsg(null);
    setPwMsg(null);
    setDeleteMsg(null);
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameLoading(true);
    setNameMsg(null);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNameMsg({ type: "success", text: "Name updated" });
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      setNameMsg({ type: "error", text: err.message });
    } finally {
      setNameLoading(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoading(true);
    setEmailMsg(null);
    try {
      const res = await fetch(`${API_BASE}/auth/change-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newEmail, password: emailPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEmailMsg({ type: "success", text: "Email changed. Redirecting..." });
      setTimeout(() => {
        localStorage.removeItem("token");
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setEmailMsg({ type: "error", text: err.message });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwLoading(true);
    setPwMsg(null);
    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPwMsg({ type: "success", text: "Password changed" });
      setCurrentPassword("");
      setNewPassword("");
      setTimeout(() => {
        setEditing(null);
        setPwMsg(null);
      }, 1500);
    } catch (err: any) {
      setPwMsg({ type: "error", text: err.message });
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteLoading(true);
    setDeleteMsg(null);
    try {
      const res = await fetch(`${API_BASE}/auth/delete-account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.removeItem("token");
      window.location.href = "/login";
    } catch (err: any) {
      setDeleteMsg({ type: "error", text: err.message });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleClearSessions = async () => {
    if (
      !confirm("Clear all sessions? You will be logged out from all devices.")
    )
      return;
    try {
      await fetch(`${API_BASE}/auth/clear-sessions`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      localStorage.removeItem("token");
      window.location.href = "/login";
    } catch {}
  };

  const deleteConfirmText = "delete my account";

  const accountItems = navItems;

  const activeLabel =
    navItems.find((i) => i.key === activeTab)?.label || "Settings";

  const tabContent = (
    <div className={isMobile ? "" : "max-w-xl mx-auto px-10 py-10"}>
      {activeTab === "general" && (
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            My Account
          </h2>

          <SectionHeading>Account Info</SectionHeading>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <SettingsRow
              label="Name"
              value={
                editing === "name" ? (
                  <div className="space-y-3 mt-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="off"
                      className="w-full text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition"
                      placeholder="Your name"
                    />
                    {nameMsg && (
                      <p
                        className={`text-xs flex items-center gap-1.5 font-medium ${nameMsg.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}
                      >
                        {nameMsg.type === "success" ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <AlertCircle size={12} />
                        )}
                        {nameMsg.text}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateName}
                        disabled={nameLoading}
                        className="px-4 py-2 text-sm font-semibold text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 transition"
                      >
                        {nameLoading ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  user?.name || "Not set"
                )
              }
              action={
                editing !== "name" && (
                  <EditButton onClick={() => handleEdit("name")} />
                )
              }
            />

            <SettingsRow
              label="Email"
              value={
                editing === "email" ? (
                  <div className="space-y-3 mt-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      autoComplete="off"
                      className="w-full text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition"
                      required
                    />
                    <input
                      type="password"
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition"
                      placeholder="Confirm with password"
                      required
                    />
                    {emailMsg && (
                      <p
                        className={`text-xs flex items-center gap-1.5 font-medium ${emailMsg.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}
                      >
                        {emailMsg.type === "success" ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <AlertCircle size={12} />
                        )}
                        {emailMsg.text}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleChangeEmail}
                        disabled={emailLoading}
                        className="px-4 py-2 text-sm font-semibold text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 transition"
                      >
                        {emailLoading ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  user?.email
                )
              }
              action={
                editing !== "email" && (
                  <EditButton onClick={() => handleEdit("email")} />
                )
              }
            />

            <SettingsRow
              label="Member Since"
              value={
                user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "—"
              }
            />
          </div>

          <SectionHeading>Danger Zone</SectionHeading>
          <div className="border border-red-200 dark:border-red-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 size={18} className="text-red-500 dark:text-red-400" />
              <div>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                  Delete Account
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Permanently delete your account and all associated data
                </p>
              </div>
            </div>
            {editing === "delete" ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  To confirm, type{" "}
                  <span className="font-mono font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                    delete my account
                  </span>{" "}
                  below:
                </p>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  autoComplete="off"
                  className="w-full text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-red-500 transition"
                  placeholder="delete my account"
                />
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-red-500 transition"
                  placeholder="Confirm your password"
                />
                {deleteMsg && (
                  <p className="text-xs flex items-center gap-1.5 font-medium text-red-500 dark:text-red-400">
                    <AlertCircle size={12} />
                    {deleteMsg.text}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={
                      deleteConfirm !== deleteConfirmText ||
                      !deletePassword ||
                      deleteLoading
                    }
                    className="px-4 py-2 text-sm font-semibold text-white bg-red-600 dark:bg-red-500 rounded-lg hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 transition"
                  >
                    {deleteLoading ? "Deleting..." : "Delete Account"}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => handleEdit("delete")}
                className="px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition"
              >
                Delete Account
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === "security" && (
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Login & Security
          </h2>

          <SectionHeading>Password & Security</SectionHeading>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <SettingsRow
              label="Password"
              value={
                editing === "password" ? (
                  <div className="space-y-3 mt-2">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition"
                      placeholder="Current password"
                      required
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition"
                      placeholder="New password (min 6 chars)"
                      required
                      minLength={6}
                    />
                    {pwMsg && (
                      <p
                        className={`text-xs flex items-center gap-1.5 font-medium ${pwMsg.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}
                      >
                        {pwMsg.type === "success" ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <AlertCircle size={12} />
                        )}
                        {pwMsg.text}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleChangePassword}
                        disabled={pwLoading}
                        className="px-4 py-2 text-sm font-semibold text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 transition"
                      >
                        {pwLoading ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  "••••••••"
                )
              }
              action={
                editing !== "password" && (
                  <EditButton onClick={() => handleEdit("password")} />
                )
              }
            />
            <SettingsRow
              label="Active Session"
              value="You're signed in on this device"
            />
          </div>

          <SectionHeading>Login History</SectionHeading>
          {loginHistory.length > 0 && (
            <button
              onClick={handleClearSessions}
              className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline mb-3"
            >
              Clear all sessions
            </button>
          )}
          {historyLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading...
            </p>
          ) : loginHistory.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No login history available
            </p>
          ) : (
            <div className="space-y-2">
              {loginHistory.map((entry, index) => {
                const browser = getBrowser(entry.userAgent);
                const os = getOS(entry.userAgent);
                const deviceInfo = [browser, os].filter(Boolean).join(" on ");
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                  >
                    <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                      <Monitor
                        size={14}
                        className="text-gray-500 dark:text-gray-300"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {deviceInfo || "Unknown device"}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatTimeAgo(entry.createdAt)}
                        </span>
                        {index === 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            Current session
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );

  // ── Mobile: Full-screen overlay ─────────────────────────
  if (isMobile) {
    return (
      <div
        className={`fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col ${isClosing ? "animate-settingsOverlayOut" : "animate-settingsOverlayIn"}`}
      >
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          {mobileView === "content" ? (
            <button
              onClick={handleMobileBack}
              className="p-1 -ml-1 text-gray-500 dark:text-gray-400"
            >
              <ChevronLeft size={22} />
            </button>
          ) : (
            <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-white font-semibold shrink-0">
              {user?.name
                ? user.name.charAt(0).toUpperCase()
                : user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {mobileView === "content" ? activeLabel : "Settings"}
            </p>
            {mobileView === "nav" && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user?.email}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="ml-auto p-2 text-gray-500 dark:text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col">
          {mobileView === "nav" ? (
            <div className="p-4 space-y-6 flex-1">
              <div>
                <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Account
                </p>
                <div className="space-y-0.5">
                  {accountItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        onClick={() => selectTab(item.key)}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                      >
                        <Icon
                          size={18}
                          className="text-gray-400 dark:text-gray-500"
                        />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                >
                  <LogOut size={18} />
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4">{tabContent}</div>
          )}
        </div>
      </div>
    );
  }

  // ── Desktop: Large modal overlay ────────────────────────
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-6 ${isClosing ? "animate-settingsOverlayOut" : "animate-settingsOverlayIn"}`}
      style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={`bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex overflow-hidden w-full max-w-6xl ${isClosing ? "animate-modalOut" : "animate-fadeScaleIn"}`}
        style={{ height: "min(90vh, 780px)" }}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 h-9 w-9 flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600 transition bg-white dark:bg-gray-900"
        >
          <X size={16} />
        </button>

        {/* Sidebar */}
        <div className="w-56 shrink-0 border-r border-gray-100 dark:border-gray-800 px-4 py-8 overflow-y-auto flex flex-col">
          <div className="flex items-center gap-3 px-1 mb-8">
            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-white font-semibold shrink-0">
              {user?.name
                ? user.name.charAt(0).toUpperCase()
                : user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {user?.name || "User"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.email}
              </p>
            </div>
          </div>

          <nav className="flex flex-col gap-6 flex-1">
            <div>
              <p className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Account
              </p>
              <div className="flex flex-col gap-0.5">
                {accountItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      onClick={() => selectTab(item.key)}
                      className={`text-left px-3 py-2.5 rounded-lg font-semibold text-sm transition flex items-center gap-2.5 ${
                        activeTab === item.key
                          ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      <Icon
                        size={15}
                        className={
                          activeTab === item.key
                            ? "text-gray-700 dark:text-gray-300"
                            : "text-gray-400 dark:text-gray-500"
                        }
                      />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>


            {/* Logout — at the bottom of sidebar */}
            <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2.5 rounded-lg font-semibold text-sm transition flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{tabContent}</div>
      </div>
    </div>
  );
}
