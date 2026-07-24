// [apps/frontend] src/pages/Login.tsx
import { useState, useEffect } from "react";
import { useAuth } from "@/services/auth";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Eye, EyeOff, Sun, Moon } from "lucide-react";
import { SeleneMark } from "@/components/SeleneMark";

type Theme = "light" | "dark" | "system";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("theme") as Theme) || "system";
}

function applyTheme(theme: Theme) {
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

function SeleneMoonPanel() {
  return (
    <div className="relative hidden md:flex flex-col justify-between overflow-hidden rounded-l-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-10 min-h-[560px]">
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        <div className="absolute top-[12%] left-[18%] h-1 w-1 rounded-full bg-white/90" />
        <div className="absolute top-[22%] left-[62%] h-0.5 w-0.5 rounded-full bg-white/70" />
        <div className="absolute top-[38%] left-[28%] h-0.5 w-0.5 rounded-full bg-white/60" />
        <div className="absolute top-[48%] left-[78%] h-1 w-1 rounded-full bg-white/80" />
        <div className="absolute top-[58%] left-[14%] h-0.5 w-0.5 rounded-full bg-white/50" />
        <div className="absolute top-[72%] left-[52%] h-0.5 w-0.5 rounded-full bg-white/70" />
      </div>
      <div
        className="pointer-events-none absolute -right-16 top-1/4 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 flex items-center gap-2.5">
        <SeleneMark size={36} className="rounded-xl" />
        <div>
          <p className="text-lg font-semibold tracking-tight">Selene</p>
          <p className="text-xs text-white/60">Smart Energy & Climate</p>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center py-10">
        <div className="relative h-44 w-44">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-100 via-indigo-100 to-slate-300 shadow-[0_0_80px_rgba(165,180,252,0.45)]" />
          <div className="absolute top-10 left-12 h-8 w-8 rounded-full bg-slate-300/50" />
          <div className="absolute top-20 left-24 h-5 w-5 rounded-full bg-slate-400/40" />
          <div className="absolute bottom-14 left-14 h-6 w-6 rounded-full bg-slate-300/40" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-l from-indigo-950/35 via-transparent to-transparent" />
        </div>
      </div>

      <div className="relative z-10 space-y-2">
        <p className="text-xl font-semibold tracking-tight leading-snug">
          Named for the moon —
          <br />
          built for clear insight.
        </p>
        <p className="text-sm text-white/65 leading-relaxed max-w-xs">
          Monitor energy, climate, and fleet health under one calm night sky of
          dashboards.
        </p>
      </div>
    </div>
  );
}

export function Login() {
  const { login, complete2fa, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" }) as { redirect?: string };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [otp, setOtp] = useState("");

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("theme", theme);
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  if (isAuthenticated) {
    navigate({ to: search.redirect || "/" });
    return null;
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.status === "2fa") {
        setPendingToken(result.pendingToken);
        setOtp("");
      } else {
        navigate({ to: search.redirect || "/" });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handle2faSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingToken) return;
    setError("");
    setLoading(true);
    try {
      await complete2fa(pendingToken, otp.trim());
      navigate({ to: search.redirect || "/" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-surface flex items-center justify-center p-4 font-sans">
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="fixed top-4 right-4 p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition z-10"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-4xl grid md:grid-cols-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card overflow-hidden">
        <SeleneMoonPanel />

        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="md:hidden flex items-center gap-2.5 mb-6">
            <SeleneMark size={36} className="rounded-xl" />
            <div>
              <p className="text-[15px] font-semibold text-gray-900 dark:text-white">
                Selene
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Smart Energy & Climate
              </p>
            </div>
          </div>

          {!pendingToken ? (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
                  Welcome back
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
                  Sign in to your Selene account
                </p>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400 mb-4 font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-900 dark:text-white mb-1.5 block">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition font-medium"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-900 dark:text-white">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/forgot-password" })}
                      className="text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 pr-10 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition font-medium"
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold rounded-xl px-4 py-2.5 hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>

              <p className="text-sm text-gray-600 dark:text-gray-300 text-center mt-5 font-medium">
                Don&apos;t have an account?{" "}
                <button
                  onClick={() => navigate({ to: "/register" })}
                  className="text-gray-900 dark:text-white font-semibold hover:underline underline-offset-2"
                >
                  Register
                </button>
              </p>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
                  Two-factor authentication
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
                  Enter the 6-digit code from your authenticator app, or a
                  backup code.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400 mb-4 font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handle2faSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-900 dark:text-white mb-1.5 block">
                    Authentication code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition font-medium tracking-widest"
                    placeholder="000000"
                    required
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold rounded-xl px-4 py-2.5 hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50"
                >
                  {loading ? "Verifying…" : "Verify and continue"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingToken(null);
                    setOtp("");
                    setError("");
                  }}
                  className="w-full text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
                >
                  Back to password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
