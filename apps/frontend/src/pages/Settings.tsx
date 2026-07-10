// [apps/frontend] src/pages/Settings.tsx
import { useState } from "react";
import { useAuth, useLoginHistory } from "@/services/auth";
import {
  CheckCircle2,
  AlertCircle,
  Trash2,
  Monitor,
  Clock,
} from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api";

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

export function Settings() {
  const { user, token } = useAuth();
  const { history: loginHistory, loading: historyLoading } = useLoginHistory();

  const [editing, setEditing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "security">("general");

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

  const handleEdit = (field: string) => {
    setEditing(field);
    if (field !== "name") {
      setName(user?.name || "");
      setNameMsg(null);
    }
    if (field !== "email") {
      setNewEmail(user?.email || "");
      setEmailPassword("");
      setEmailMsg(null);
    }
    if (field !== "password") {
      setCurrentPassword("");
      setNewPassword("");
      setPwMsg(null);
    }
    if (field !== "delete") {
      setDeleteConfirm("");
      setDeletePassword("");
      setDeleteMsg(null);
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

  const deleteConfirmText = "delete my account";

  return (
    <div className="flex flex-col md:flex-row gap-10 max-w-4xl w-full">
      {/* Left Sidebar */}
      <div className="w-full md:w-48 shrink-0">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Settings</h2>
        <nav className="flex flex-col space-y-1">
          <button
            onClick={() => {
              setActiveTab("general");
              setEditing(null);
            }}
            className={`text-left px-3 py-2 rounded-lg font-medium text-sm transition ${activeTab === "general" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"}`}
          >
            General
          </button>
          <button
            onClick={() => {
              setActiveTab("security");
              setEditing(null);
            }}
            className={`text-left px-3 py-2 rounded-lg font-medium text-sm transition ${activeTab === "security" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"}`}
          >
            Login & Security
          </button>
        </nav>
      </div>

      {/* Right Content */}
      <div className="flex-1 max-w-xl">
        {/* Avatar */}
        <div className="flex items-center gap-4 pb-6 border-b border-gray-100 mb-2">
          <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-lg shrink-0">
            {user?.name
              ? user.name.charAt(0).toUpperCase()
              : user?.email?.charAt(0).toUpperCase() || "U"}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {user?.name || "User"}
            </p>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>
        </div>

        {/* General Tab */}
        {activeTab === "general" && (
          <div className="flex flex-col">
            {/* Name */}
            <div className="py-4 border-b border-gray-100">
              <div
                className={`transition-all duration-300 overflow-hidden ${editing === "name" ? "max-h-96 opacity-100" : editing ? "max-h-0 opacity-0" : "max-h-96 opacity-100"}`}
              >
                {editing === "name" ? (
                  <div className="space-y-3 animate-slideDown">
                    <label className="text-sm font-medium text-gray-900 block">
                      Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full max-w-xs text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-gray-500 transition"
                      placeholder="Your name"
                    />
                    {nameMsg && (
                      <p
                        className={`text-xs flex items-center gap-1.5 ${nameMsg.type === "success" ? "text-emerald-600" : "text-red-500"}`}
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
                        type="submit"
                        onClick={handleUpdateName}
                        disabled={nameLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                      >
                        {nameLoading ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  !editing && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Name
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {user?.name || "Not set"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleEdit("name")}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                      >
                        Edit
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Email */}
            <div className="py-4 border-b border-gray-100">
              <div
                className={`transition-all duration-300 overflow-hidden ${editing === "email" ? "max-h-96 opacity-100" : editing ? "max-h-0 opacity-0" : "max-h-96 opacity-100"}`}
              >
                {editing === "email" ? (
                  <div className="space-y-3 animate-slideDown">
                    <label className="text-sm font-medium text-gray-900 block">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full max-w-xs text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-gray-500 transition"
                      required
                    />
                    <label className="text-sm font-medium text-gray-900 block">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                      className="w-full max-w-xs text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-gray-500 transition"
                      placeholder="Confirm to change email"
                      required
                    />
                    {emailMsg && (
                      <p
                        className={`text-xs flex items-center gap-1.5 ${emailMsg.type === "success" ? "text-emerald-600" : "text-red-500"}`}
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
                        type="submit"
                        onClick={handleChangeEmail}
                        disabled={emailLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                      >
                        {emailLoading ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  !editing && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Email
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {user?.email}
                        </p>
                      </div>
                      <button
                        onClick={() => handleEdit("email")}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                      >
                        Edit
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Member Since */}
            <div className="py-4 border-b border-gray-100">
              <div
                className={`transition-all duration-300 overflow-hidden ${editing ? "max-h-0 opacity-0" : "max-h-96 opacity-100"}`}
              >
                {!editing && (
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Member since
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {user?.createdAt
                        ? new Date(user.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="py-4 mt-4">
              <div className="bg-white border border-red-200 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Trash2 size={18} className="text-red-500" />
                  <div>
                    <p className="text-sm font-semibold text-red-600">
                      Danger Zone
                    </p>
                    <p className="text-xs text-gray-400">
                      Permanently delete your account and all associated data
                    </p>
                  </div>
                </div>

                <div
                  className={`transition-all duration-300 overflow-hidden ${editing === "delete" ? "max-h-96 opacity-100" : editing ? "max-h-0 opacity-0" : "max-h-96 opacity-100"}`}
                >
                  {editing === "delete" ? (
                    <div className="space-y-3 animate-slideDown">
                      <p className="text-xs text-gray-500">
                        To confirm, type{" "}
                        <span className="font-mono font-semibold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">
                          delete my account
                        </span>{" "}
                        below:
                      </p>
                      <input
                        type="text"
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        className="w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-red-500 transition"
                        placeholder="delete my account"
                      />
                      <label className="text-sm font-medium text-gray-900 block">
                        Your Password
                      </label>
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        className="w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-red-500 transition"
                        placeholder="Confirm your password"
                      />
                      {deleteMsg && (
                        <p className="text-xs flex items-center gap-1.5 text-red-500">
                          <AlertCircle size={12} />
                          {deleteMsg.text}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleDeleteAccount}
                          disabled={
                            deleteConfirm !== deleteConfirmText ||
                            !deletePassword ||
                            deleteLoading
                          }
                          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
                        >
                          {deleteLoading ? "Deleting..." : "Delete Account"}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    !editing && (
                      <button
                        onClick={() => handleEdit("delete")}
                        className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
                      >
                        Delete Account
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Login & Security Tab */}
        {activeTab === "security" && (
          <div className="flex flex-col">
            {/* Password */}
            <div className="py-4 border-b border-gray-100">
              <div
                className={`transition-all duration-300 overflow-hidden ${editing === "password" ? "max-h-96 opacity-100" : editing ? "max-h-0 opacity-0" : "max-h-96 opacity-100"}`}
              >
                {editing === "password" ? (
                  <div className="space-y-3 animate-slideDown">
                    <label className="text-sm font-medium text-gray-900 block">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full max-w-xs text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-gray-500 transition"
                      required
                    />
                    <label className="text-sm font-medium text-gray-900 block">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full max-w-xs text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-gray-500 transition"
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-gray-400">
                      At least 6 characters
                    </p>
                    {pwMsg && (
                      <p
                        className={`text-xs flex items-center gap-1.5 ${pwMsg.type === "success" ? "text-emerald-600" : "text-red-500"}`}
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
                        type="submit"
                        onClick={handleChangePassword}
                        disabled={pwLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                      >
                        {pwLoading ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  !editing && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Password
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">••••••••</p>
                      </div>
                      <button
                        onClick={() => handleEdit("password")}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                      >
                        Edit
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Active Session */}
            <div className="py-4 border-b border-gray-100">
              <div
                className={`transition-all duration-300 overflow-hidden ${editing ? "max-h-0 opacity-0" : "max-h-96 opacity-100"}`}
              >
                {!editing && (
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Active Session
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      You're signed in on this device
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Login History */}
            <div className="py-4">
              <div
                className={`transition-all duration-300 overflow-hidden ${editing ? "max-h-0 opacity-0" : "max-h-96 opacity-100"}`}
              >
                {!editing && (
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-3">
                      Login History
                    </p>
                    {historyLoading ? (
                      <p className="text-sm text-gray-400">Loading...</p>
                    ) : loginHistory.length === 0 ? (
                      <p className="text-sm text-gray-400">
                        No login history available
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {loginHistory.map((entry, index) => {
                          const browser = getBrowser(entry.userAgent);
                          const os = getOS(entry.userAgent);
                          const deviceInfo = [browser, os]
                            .filter(Boolean)
                            .join(" on ");
                          return (
                            <div
                              key={entry.id}
                              className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-gray-50 border border-gray-100"
                            >
                              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                                <Monitor size={14} className="text-gray-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {deviceInfo || "Unknown device"}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                                  <span className="flex items-center gap-1">
                                    <Clock size={10} />
                                    {formatTimeAgo(entry.createdAt)}
                                  </span>
                                  {index === 0 && (
                                    <span className="text-emerald-600 font-medium">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
