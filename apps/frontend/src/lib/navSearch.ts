// apps/frontend/src/lib/navSearch.ts
// Global navigation search catalog (pages + deep tab targets).

export type NavSearchItem = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  /** Path without query */
  to: string;
  /** Optional tab deep-link (applied as ?tab=) */
  tab?: string;
  adminOnly?: boolean;
};

export const NAV_SEARCH_ITEMS: NavSearchItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Live energy & climate overview",
    keywords: ["home", "overview", "live", "power", "climate"],
    to: "/",
  },
  {
    id: "log",
    label: "Data Log",
    description: "Reading history, CSV & TSV export",
    keywords: [
      "export",
      "csv",
      "tsv",
      "download",
      "history",
      "log",
      "readings",
      "data",
    ],
    to: "/log",
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Energy, environment & fuzzy insights",
    keywords: ["charts", "analysis", "stats", "analytics"],
    to: "/analytics",
  },
  {
    id: "analytics-energy",
    label: "Energy Analytics",
    description: "Power patterns and energy summary",
    keywords: ["energy", "power", "kwh", "consumption"],
    to: "/analytics",
    tab: "energy",
  },
  {
    id: "analytics-environment",
    label: "Environment Analytics",
    description: "Temperature, humidity, comfort",
    keywords: ["environment", "env", "temperature", "humidity", "comfort"],
    to: "/analytics",
    tab: "environment",
  },
  {
    id: "analytics-fuzzy",
    label: "Energy Fuzzy (E-Fuzzy)",
    description: "Energy fuzzy classification",
    keywords: [
      "e-fuzzy",
      "efuzzy",
      "energy fuzzy",
      "fuzzy energy",
      "wasteful",
      "economical",
    ],
    to: "/analytics",
    tab: "fuzzy",
  },
  {
    id: "analytics-climate-fuzzy",
    label: "Climate Fuzzy (C-Fuzzy)",
    description: "Thermal comfort fuzzy analysis",
    keywords: [
      "c-fuzzy",
      "cfuzzy",
      "climate fuzzy",
      "fuzzy climate",
      "ashrae",
      "thermal",
    ],
    to: "/analytics",
    tab: "climate-fuzzy",
  },
  {
    id: "admin",
    label: "Admin Tools",
    description: "Users, firmware OTA, system health",
    keywords: ["admin", "administration", "manage"],
    to: "/admin",
    adminOnly: true,
  },
  {
    id: "admin-users",
    label: "Admin · Users",
    description: "User management",
    keywords: ["users", "roles", "accounts"],
    to: "/admin",
    tab: "users",
    adminOnly: true,
  },
  {
    id: "admin-firmware",
    label: "Admin · Firmware",
    description: "OTA updates and device nodes",
    keywords: ["firmware", "ota", "esp32", "flash", "upload"],
    to: "/admin",
    tab: "firmware",
    adminOnly: true,
  },
  {
    id: "admin-system",
    label: "Admin · System",
    description: "System health and status",
    keywords: ["system", "health", "status", "mqtt"],
    to: "/admin",
    tab: "system",
    adminOnly: true,
  },
  {
    id: "impressum",
    label: "Impressum",
    description: "About Selene",
    keywords: ["about", "impressum", "legal", "project"],
    to: "/impressum",
  },
  {
    id: "impressum-about",
    label: "Impressum · About",
    description: "Project information",
    keywords: ["about selene", "about"],
    to: "/impressum",
    tab: "about",
  },
  {
    id: "impressum-ack",
    label: "Impressum · Acknowledgement",
    description: "Credits and acknowledgements",
    keywords: [
      "acknowledgement",
      "acknowledgment",
      "credits",
      "thanks",
      "license",
    ],
    to: "/impressum",
    tab: "acknowledgement",
  },
  {
    id: "glossary",
    label: "Glossary",
    description: "Terms and definitions",
    keywords: ["glossary", "terms", "definitions", "help"],
    to: "/glossary",
  },
];

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

export function searchNavItems(
  query: string,
  opts?: { isAdmin?: boolean },
): NavSearchItem[] {
  const q = normalize(query);
  if (!q) return [];

  const isAdmin = opts?.isAdmin ?? false;
  const pool = NAV_SEARCH_ITEMS.filter((i) => !i.adminOnly || isAdmin);

  const scored = pool
    .map((item) => {
      const label = normalize(item.label);
      const desc = normalize(item.description);
      const keys = item.keywords.map(normalize);

      let score = 0;
      if (label === q) score += 100;
      else if (label.startsWith(q)) score += 80;
      else if (label.includes(q)) score += 50;

      if (keys.some((k) => k === q)) score += 90;
      else if (keys.some((k) => k.startsWith(q))) score += 70;
      else if (keys.some((k) => k.includes(q))) score += 40;

      if (desc.includes(q)) score += 15;

      // multi-word: all tokens present
      const tokens = q.split(/\s+/).filter(Boolean);
      if (tokens.length > 1) {
        const hay = `${label} ${desc} ${keys.join(" ")}`;
        if (tokens.every((t) => hay.includes(t))) score += 25;
      }

      return { item, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 8).map((x) => x.item);
}

export function hrefForNavItem(item: NavSearchItem): string {
  if (!item.tab) return item.to;
  const sep = item.to.includes("?") ? "&" : "?";
  return `${item.to}${sep}tab=${encodeURIComponent(item.tab)}`;
}
