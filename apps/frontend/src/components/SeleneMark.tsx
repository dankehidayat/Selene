// Lightweight moon mark — theme-aware contrast so it never blends into
// light or dark chrome (especially the mobile drawer / login header).
import { useId } from "react";

type Props = {
  className?: string;
  size?: number;
  title?: string;
};

export function SeleneMark({
  className = "",
  size = 36,
  title = "Selene",
}: Props) {
  // Unique gradient IDs per instance (shared ids break when 2+ icons mount)
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 rounded-[10px] shadow-sm ring-1 ring-black/10 dark:ring-white/25 ${className}`}
      role="img"
      aria-label={title}
    >
      <defs>
        {/* Light theme: deep night sky */}
        <linearGradient
          id={`${uid}-bg-light`}
          x1="8"
          y1="4"
          x2="34"
          y2="38"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0f172a" />
          <stop offset="0.55" stopColor="#1e1b4b" />
          <stop offset="1" stopColor="#0c1222" />
        </linearGradient>
        {/* Dark theme: lifted indigo so it doesn't sink into gray-900 */}
        <linearGradient
          id={`${uid}-bg-dark`}
          x1="8"
          y1="4"
          x2="34"
          y2="38"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#3730a3" />
          <stop offset="0.5" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#312e81" />
        </linearGradient>
        <linearGradient
          id={`${uid}-moon`}
          x1="14"
          y1="10"
          x2="30"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#f8fafc" />
          <stop offset="0.45" stopColor="#e0e7ff" />
          <stop offset="1" stopColor="#c7d2fe" />
        </linearGradient>
        <radialGradient
          id={`${uid}-glow`}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(22 18) rotate(90) scale(14)"
        >
          <stop stopColor="#a5b4fc" stopOpacity="0.55" />
          <stop offset="1" stopColor="#a5b4fc" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Theme-specific tile backgrounds */}
      <rect
        width="40"
        height="40"
        rx="10"
        className="dark:hidden"
        fill={`url(#${uid}-bg-light)`}
      />
      <rect
        width="40"
        height="40"
        rx="10"
        className="hidden dark:block"
        fill={`url(#${uid}-bg-dark)`}
      />

      <circle cx="22" cy="18" r="12" fill={`url(#${uid}-glow)`} />
      <circle cx="21" cy="19" r="9" fill={`url(#${uid}-moon)`} />

      {/* terminator — softer on dark tile */}
      <path
        d="M24.5 10.4a9 9 0 1 0 0 17.2 7.2 7.2 0 1 1 0-17.2z"
        className="fill-slate-950/25 dark:fill-indigo-950/35"
      />

      {/* craters */}
      <circle cx="17.5" cy="16" r="1.6" className="fill-slate-400/50 dark:fill-indigo-200/35" />
      <circle cx="22" cy="21.5" r="1.1" className="fill-slate-400/40 dark:fill-indigo-200/30" />
      <circle cx="18.8" cy="23" r="0.8" className="fill-slate-400/35 dark:fill-indigo-200/25" />

      {/* stars — brighter on dark tile */}
      <circle cx="9" cy="11" r="0.7" className="fill-slate-100 dark:fill-white" />
      <circle cx="31" cy="13" r="0.5" className="fill-slate-100/90 dark:fill-white/90" />
      <circle cx="28" cy="29" r="0.55" className="fill-slate-100/80 dark:fill-white/85" />
    </svg>
  );
}
