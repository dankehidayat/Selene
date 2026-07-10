// [apps/frontend] src/pages/Register.tsx
import { useState, useEffect } from "react";
import { useAuth } from "@/services/auth";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Sun, Moon } from "lucide-react";

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

export function Register() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

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
    navigate({ to: "/" });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, name);
      navigate({ to: "/" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-gray-950 flex items-center justify-center p-4 font-sans">
      {/* Theme toggle - top right */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="fixed top-4 right-4 p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition z-10"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Create account
          </h1>
          <p className="text-sm text-gray-900 dark:text-white mt-1 font-medium">
            Start monitoring your energy usage
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400 mb-4 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-900 dark:text-white mb-1.5 block">
              Name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition font-medium"
              placeholder="Your name"
            />
          </div>
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
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-900 dark:text-white mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 pr-10 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition font-medium"
                placeholder="••••••••"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-gray-900 dark:text-white mt-1 font-medium">
              At least 6 characters
            </p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold rounded-xl px-4 py-2.5 hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-sm text-gray-900 dark:text-white text-center mt-4 font-medium">
          Already have an account?{" "}
          <button
            onClick={() => navigate({ to: "/login" })}
            className="text-gray-900 dark:text-white font-semibold hover:underline underline-offset-2"
          >
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
}
