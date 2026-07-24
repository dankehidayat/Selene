// Lightweight moon mark matching the login panel aesthetic (inline SVG, no PNG).

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
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id="smBg" x1="8" y1="4" x2="34" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f172a" />
          <stop offset="0.55" stopColor="#1e1b4b" />
          <stop offset="1" stopColor="#0c1222" />
        </linearGradient>
        <linearGradient id="smMoon" x1="14" y1="10" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f1f5f9" />
          <stop offset="0.5" stopColor="#e0e7ff" />
          <stop offset="1" stopColor="#cbd5e1" />
        </linearGradient>
        <radialGradient id="smGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(22 18) rotate(90) scale(14)">
          <stop stopColor="#a5b4fc" stopOpacity="0.45" />
          <stop offset="1" stopColor="#a5b4fc" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#smBg)" />
      <circle cx="22" cy="18" r="12" fill="url(#smGlow)" />
      <circle cx="21" cy="19" r="9" fill="url(#smMoon)" />
      {/* soft terminator */}
      <path
        d="M24.5 10.4a9 9 0 1 0 0 17.2 7.2 7.2 0 1 1 0-17.2z"
        fill="#0f172a"
        fillOpacity="0.22"
      />
      {/* craters */}
      <circle cx="17.5" cy="16" r="1.6" fill="#94a3b8" fillOpacity="0.45" />
      <circle cx="22" cy="21.5" r="1.1" fill="#94a3b8" fillOpacity="0.35" />
      <circle cx="18.8" cy="23" r="0.8" fill="#94a3b8" fillOpacity="0.3" />
      {/* stars */}
      <circle cx="9" cy="11" r="0.7" fill="#e2e8f0" fillOpacity="0.85" />
      <circle cx="31" cy="13" r="0.5" fill="#e2e8f0" fillOpacity="0.7" />
      <circle cx="28" cy="29" r="0.55" fill="#e2e8f0" fillOpacity="0.65" />
    </svg>
  );
}
