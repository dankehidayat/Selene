// apps/frontend/src/pages/ResetPassword.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export function ResetPassword() {
  const navigate = useNavigate();
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") || "";
  }, []);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Missing reset token. Open the link from your email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-surface flex items-center justify-center p-4 font-sans">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card p-8 w-full max-w-md">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
          Choose a new password
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 font-medium">
          Pick something memorable and unique to Selene.
        </p>

        {done ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200 font-medium">
              Password updated. You can sign in now.
            </div>
            <button
              type="button"
              onClick={() => navigate({ to: "/login" })}
              className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold rounded-xl px-4 py-2.5 hover:bg-gray-800 dark:hover:bg-gray-100 transition"
            >
              Go to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400 font-medium">
                {error}
              </div>
            )}
            {!token && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                No token in the URL. Use the full link from your email.
              </p>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-900 dark:text-white mb-1.5 block">
                New password
              </label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 pr-10 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-900 dark:text-white mb-1.5 block">
                Confirm password
              </label>
              <input
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !token}
              className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold rounded-xl px-4 py-2.5 hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50"
            >
              {loading ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
