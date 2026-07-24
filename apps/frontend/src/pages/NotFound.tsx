// apps/frontend/src/pages/NotFound.tsx
import { Link } from "@tanstack/react-router";
import { Home, ArrowLeft, Search } from "lucide-react";

export function NotFound() {
  return (
    <div className="min-h-screen bg-app-surface flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/80 dark:bg-gray-900/70 border border-gray-200/80 dark:border-gray-700/80 shadow-sm">
          <Search size={28} className="text-gray-400 dark:text-gray-500" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          That URL doesn&apos;t match anything in Selene. It may be a typo, an
          old bookmark, or a link that moved.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition"
          >
            <Home size={16} />
            Go to dashboard
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-white/70 dark:hover:bg-gray-900/60 transition"
          >
            <ArrowLeft size={16} />
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
