// apps/frontend/src/pages/Impressum.tsx
import { useState } from "react";
import {
  ExternalLink,
  Mail,
  User,
  GraduationCap,
  School,
  Globe,
  Code,
  Activity,
  Shield,
  Layers,
  Database,
  Cpu,
  Radio,
  Boxes,
  Network,
  HardDrive,
} from "lucide-react";
import { ChartCard } from "@/components/ChartCard";
import { useTabFromSearch } from "@/hooks/useTabFromSearch";

const IMPRESSUM_TAB_KEYS = ["about", "acknowledgement"] as const;

interface PackageInfo {
  name: string;
  version: string;
  license: string;
  url: string;
  description: string;
}

const frontendPackages: PackageInfo[] = [
  {
    name: "React",
    version: "^18.3.1",
    license: "MIT",
    url: "https://react.dev",
    description: "A JavaScript library for building user interfaces",
  },
  {
    name: "React DOM",
    version: "^18.3.1",
    license: "MIT",
    url: "https://react.dev",
    description: "React package for working with the DOM",
  },
  {
    name: "Vite",
    version: "^8.1.4",
    license: "MIT",
    url: "https://vitejs.dev",
    description: "Next-generation frontend build tool",
  },
  {
    name: "TypeScript",
    version: "^5.5.4",
    license: "Apache-2.0",
    url: "https://www.typescriptlang.org",
    description: "Typed superset of JavaScript",
  },
  {
    name: "Tailwind CSS",
    version: "^3.4.10",
    license: "MIT",
    url: "https://tailwindcss.com",
    description: "Utility-first CSS framework",
  },
  {
    name: "@tanstack/react-router",
    version: "^1.58.0",
    license: "MIT",
    url: "https://tanstack.com/router",
    description: "Fully-featured React routing solution",
  },
  {
    name: "@tanstack/react-query",
    version: "^5.56.0",
    license: "MIT",
    url: "https://tanstack.com/query",
    description: "Powerful data fetching and state management",
  },
  {
    name: "Recharts",
    version: "^2.12.7",
    license: "MIT",
    url: "https://recharts.org",
    description: "Composable charting library built on React components",
  },
  {
    name: "Lucide React",
    version: "^1.24.0",
    license: "ISC",
    url: "https://lucide.dev",
    description: "Beautiful & consistent icon toolkit",
  },
  {
    name: "@observablehq/plot",
    version: "^0.6.17",
    license: "ISC",
    url: "https://observablehq.com/plot",
    description: "High-level declarative visualization library",
  },
  {
    name: "@radix-ui/react-dialog",
    version: "^1.1.1",
    license: "MIT",
    url: "https://www.radix-ui.com",
    description: "Unstyled, accessible dialog primitive",
  },
  {
    name: "@radix-ui/react-dropdown-menu",
    version: "^2.1.1",
    license: "MIT",
    url: "https://www.radix-ui.com",
    description: "Unstyled, accessible dropdown menu primitive",
  },
  {
    name: "@radix-ui/react-hover-card",
    version: "^1.1.19",
    license: "MIT",
    url: "https://www.radix-ui.com",
    description: "Unstyled, accessible hover card primitive",
  },
  {
    name: "@radix-ui/react-popover",
    version: "^1.1.19",
    license: "MIT",
    url: "https://www.radix-ui.com",
    description: "Unstyled, accessible popover primitive",
  },
  {
    name: "@radix-ui/react-scroll-area",
    version: "^1.1.0",
    license: "MIT",
    url: "https://www.radix-ui.com",
    description: "Unstyled, accessible scroll area primitive",
  },
  {
    name: "@radix-ui/react-separator",
    version: "^1.1.0",
    license: "MIT",
    url: "https://www.radix-ui.com",
    description: "Unstyled, accessible separator primitive",
  },
  {
    name: "@radix-ui/react-tooltip",
    version: "^1.1.2",
    license: "MIT",
    url: "https://www.radix-ui.com",
    description: "Unstyled, accessible tooltip primitive",
  },
  {
    name: "clsx",
    version: "^2.1.1",
    license: "MIT",
    url: "https://github.com/lukeed/clsx",
    description: "Utility for constructing className strings",
  },
  {
    name: "tailwind-merge",
    version: "^2.5.2",
    license: "MIT",
    url: "https://github.com/dcastil/tailwind-merge",
    description: "Merge Tailwind CSS classes efficiently without conflicts",
  },
  {
    name: "html2canvas",
    version: "^1.4.1",
    license: "MIT",
    url: "https://html2canvas.hertzen.com",
    description: "Client-side chart capture for PNG export & clipboard",
  },
  {
    name: "file-saver",
    version: "^2.0.5",
    license: "MIT",
    url: "https://github.com/eligrey/FileSaver.js",
    description: "Save files on the client-side",
  },
  {
    name: "mqtt (js)",
    version: "^5.15.2",
    license: "MIT",
    url: "https://github.com/mqttjs/MQTT.js",
    description: "MQTT client (browser utilities where needed)",
  },
];

const backendPackages: PackageInfo[] = [
  {
    name: "Fastify",
    version: "^4.28.0",
    license: "MIT",
    url: "https://fastify.dev",
    description: "Fast and low overhead web framework for Node.js",
  },
  {
    name: "Bun",
    version: "1.x",
    license: "MIT",
    url: "https://bun.sh",
    description: "JavaScript runtime & package manager",
  },
  {
    name: "@prisma/client + prisma",
    version: "^6.19.3",
    license: "Apache-2.0",
    url: "https://www.prisma.io",
    description: "ORM and migrations for PostgreSQL (users, glossary, …)",
  },
  {
    name: "mqtt",
    version: "^5.10.1",
    license: "MIT",
    url: "https://github.com/mqttjs/MQTT.js",
    description: "MQTT ingest from EMQX (ESP32 telemetry & OTA commands)",
  },
  {
    name: "pg",
    version: "^8.13.0",
    license: "MIT",
    url: "https://node-postgres.com",
    description: "PostgreSQL / TimescaleDB driver",
  },
  {
    name: "bcryptjs",
    version: "^2.4.3",
    license: "MIT",
    url: "https://github.com/dcodeIO/bcrypt.js",
    description: "Password hashing",
  },
  {
    name: "jsonwebtoken",
    version: "^9.0.2",
    license: "MIT",
    url: "https://github.com/auth0/node-jsonwebtoken",
    description: "JWT auth for API sessions",
  },
  {
    name: "@fastify/cors",
    version: "^9.0.1",
    license: "MIT",
    url: "https://github.com/fastify/fastify-cors",
    description: "CORS for browser clients",
  },
  {
    name: "@fastify/multipart",
    version: "^8.3.1",
    license: "MIT",
    url: "https://github.com/fastify/fastify-multipart",
    description: "Firmware .bin upload for OTA",
  },
  {
    name: "@fastify/swagger + swagger-ui",
    version: "^8 / ^3",
    license: "MIT",
    url: "https://github.com/fastify/fastify-swagger",
    description: "OpenAPI docs at /docs",
  },
  {
    name: "@selene/shared",
    version: "workspace",
    license: "Project",
    url: "https://github.com/dankehidayat/Selene",
    description: "Shared types, MQTT topics, Timescale helpers",
  },
  {
    name: "@selene/sensors",
    version: "workspace",
    license: "Project",
    url: "https://github.com/dankehidayat/Selene",
    description: "PZEM-004T + DHT11 parser registry (modular sensors)",
  },
  {
    name: "PostgreSQL 16",
    version: "16.x",
    license: "PostgreSQL",
    url: "https://www.postgresql.org",
    description: "Relational store for accounts & metadata",
  },
  {
    name: "TimescaleDB",
    version: "2.x / PG16",
    license: "Timescale License",
    url: "https://www.timescale.com",
    description: "Time-series hypertables for sensor readings",
  },
  {
    name: "EMQX",
    version: "5.7",
    license: "Apache-2.0",
    url: "https://www.emqx.io",
    description: "MQTT broker for fleet telemetry and OTA commands",
  },
];

const iotPackages: PackageInfo[] = [
  {
    name: "ESP32 DevKit V1",
    version: "—",
    license: "Hardware",
    url: "https://www.espressif.com",
    description: "Wi-Fi MCU running Eco Office firmware",
  },
  {
    name: "PZEM-004T",
    version: "V3",
    license: "Hardware",
    url: "https://innovatorsguru.com/pzem-004t",
    description: "AC energy measurement (energy domain)",
  },
  {
    name: "DHT11",
    version: "—",
    license: "Hardware",
    url: "https://www.mouser.com/datasheet/2/758/DHT11-Technical-Data-Sheet-Translated-Version-1143054.pdf",
    description: "Temperature & humidity (environment domain)",
  },
  {
    name: "Eco Office firmware",
    version: "feat/selene-mqtt-ota",
    license: "See repo",
    url: "https://github.com/dankehidayat/Eco-Office/blob/feat/selene-mqtt-ota/Eco%20Office.ino",
    description: "MQTT telemetry + HTTPS OTA sketch (separate repo)",
  },
  {
    name: "Arduino IDE / ESP32 core",
    version: "2.x",
    license: "LGPL / Apache",
    url: "https://www.arduino.cc",
    description: "Build & flash tooling for the edge device",
  },
];

const devPackages: PackageInfo[] = [
  {
    name: "@vitejs/plugin-react",
    version: "^4.3.1",
    license: "MIT",
    url: "https://github.com/vitejs/vite-plugin-react",
    description: "Vite plugin for React with Babel/SWC",
  },
  {
    name: "autoprefixer",
    version: "^10.4.20",
    license: "MIT",
    url: "https://github.com/postcss/autoprefixer",
    description: "Parse CSS and add vendor prefixes",
  },
  {
    name: "postcss",
    version: "^8.4.45",
    license: "MIT",
    url: "https://postcss.org",
    description: "Tool for transforming CSS with JavaScript plugins",
  },
  {
    name: "@types/react",
    version: "^18.3.5",
    license: "MIT",
    url: "https://www.npmjs.com/package/@types/react",
    description: "TypeScript definitions for React",
  },
  {
    name: "@types/react-dom",
    version: "^18.3.0",
    license: "MIT",
    url: "https://www.npmjs.com/package/@types/react-dom",
    description: "TypeScript definitions for React DOM",
  },
  {
    name: "@types/file-saver",
    version: "^2.0.7",
    license: "MIT",
    url: "https://www.npmjs.com/package/@types/file-saver",
    description: "TypeScript definitions for file-saver",
  },
  {
    name: "@types/bcryptjs",
    version: "^2.4.6",
    license: "MIT",
    url: "https://www.npmjs.com/package/@types/bcryptjs",
    description: "TypeScript definitions for bcryptjs",
  },
  {
    name: "@types/jsonwebtoken",
    version: "^9.0.7",
    license: "MIT",
    url: "https://www.npmjs.com/package/@types/jsonwebtoken",
    description: "TypeScript definitions for jsonwebtoken",
  },
  {
    name: "@types/pg",
    version: "^8.11.0",
    license: "MIT",
    url: "https://www.npmjs.com/package/@types/pg",
    description: "TypeScript definitions for pg",
  },
  {
    name: "@types/node",
    version: "^20.14.0",
    license: "MIT",
    url: "https://www.npmjs.com/package/@types/node",
    description: "TypeScript definitions for Node.js",
  },
];

function PackageTable({
  packages,
  title,
}: {
  packages: PackageInfo[];
  title: string;
}) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-3">
        {title}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs border-b border-gray-200 dark:border-gray-700">
              <th className="font-semibold py-2.5 px-2 text-gray-900 dark:text-white">
                Package
              </th>
              <th className="font-semibold py-2.5 px-2 text-gray-900 dark:text-white">
                Version
              </th>
              <th className="font-semibold py-2.5 px-2 text-gray-900 dark:text-white">
                License
              </th>
              <th className="font-semibold py-2.5 px-2 hidden md:table-cell text-gray-900 dark:text-white">
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            {packages.map((pkg) => (
              <tr
                key={pkg.name}
                className="border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                <td className="py-3 px-2">
                  <a
                    href={pkg.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-900 dark:text-white font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition inline-flex items-center gap-1"
                  >
                    {pkg.name}{" "}
                    <ExternalLink
                      size={11}
                      className="text-gray-500 dark:text-white"
                    />
                  </a>
                </td>
                <td className="py-3 px-2 text-gray-700 dark:text-white tabular-nums font-medium">
                  {pkg.version}
                </td>
                <td className="py-3 px-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white">
                    {pkg.license}
                  </span>
                </td>
                <td className="py-3 px-2 text-gray-700 dark:text-white hidden md:table-cell font-medium">
                  {pkg.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Impressum() {
  const [activeTab, setActiveTab] = useState<"about" | "acknowledgement">(
    "about",
  );
  useTabFromSearch(IMPRESSUM_TAB_KEYS, setActiveTab);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Impressum
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
          About this project and its creator
        </p>
      </div>

      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {(["about", "acknowledgement"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 active:scale-[0.97] ${activeTab === tab ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"}`}
            >
              {tab === "about" ? "About Selene" : "Acknowledgement"}
            </button>
          ))}
        </div>
      </div>

      <div key={activeTab} className="animate-tabIn">
      {activeTab === "about" && (
        <div className="space-y-6 max-w-2xl mx-auto">
          <ChartCard title="Project Information">
            <div className="space-y-4">
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                Selene
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
                Smart energy &amp; climate dashboard for ESP32 fleets. Edge
                devices (Eco Office firmware) publish{" "}
                <strong>PZEM-004T</strong> electrical data and{" "}
                <strong>DHT11</strong> temperature/humidity over{" "}
                <strong>MQTT (EMQX)</strong>. The monorepo backend ingests via a{" "}
                <strong>sensor parser registry</strong>, stores time-series in
                TimescaleDB, and serves analytics, auth, and OTA over a Fastify
                API — structured for future microservices without requiring them
                in production today.
              </p>
            </div>
          </ChartCard>

          <ChartCard title="Tech Stack Used">
            <div className="flex flex-wrap gap-2">
              {[
                ["React 18", "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"],
                ["TypeScript", "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"],
                ["Vite", "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400"],
                ["Fastify + Bun", "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"],
                ["PostgreSQL", "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400"],
                ["TimescaleDB", "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"],
                ["Prisma", "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"],
                ["MQTT / EMQX", "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"],
                ["@selene/sensors", "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400"],
                ["TanStack", "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"],
                ["Recharts", "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400"],
                ["Tailwind CSS", "bg-lime-50 dark:bg-lime-900/30 text-lime-700 dark:text-lime-400"],
              ].map(([label, cls]) => (
                <span
                  key={label}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg ${cls}`}
                >
                  {label}
                </span>
              ))}
            </div>
          </ChartCard>

          <ChartCard title="Key Features">
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              <div className="flex items-start gap-3 py-3">
                <Radio size={16} className="text-indigo-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    MQTT-first fleet ingest
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    EMQX broker, topic{" "}
                    <code className="text-[10px]">selene/&lt;node&gt;/telemetry</code>
                    , live SSE to the dashboard, and OTA commands on{" "}
                    <code className="text-[10px]">…/command</code>.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 py-3">
                <Boxes size={16} className="text-teal-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Modular sensor packages
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    <code className="text-[10px]">@selene/shared</code> +{" "}
                    <code className="text-[10px]">@selene/sensors</code> parser
                    registry for PZEM (energy) and DHT11 (environment), ready for
                    lux/soil-style extensions.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 py-3">
                <Network size={16} className="text-violet-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Microservice-ready monorepo
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    Domain scaffolds (auth, energy, climate, firmware, ingestor)
                    and modular Compose/Caddy layouts — production still ships as
                    a reliable monolith until you split services.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 py-3">
                <HardDrive
                  size={16}
                  className="text-emerald-500 mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Time-series + dual fuzzy engines
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    TimescaleDB hypertables; energy fuzzy (IEEE-style rules) and
                    climate fuzzy (ASHRAE 55–inspired comfort).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 py-3">
                <Shield size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Admin, OTA &amp; RBAC
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    User roles, Admin Tools (users, firmware OTA, system), JWT
                    auth, and session history.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 py-3">
                <Layers size={16} className="text-cyan-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Analytics workspace
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    Energy &amp; environment charts, fuzzy distributions,
                    membership functions, decision surfaces, and PNG export.
                  </p>
                </div>
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Developer Information">
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              <div className="flex items-center gap-3 py-3">
                <User size={16} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Danke Hidayat
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Author & Developer
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 py-3">
                <Mail size={16} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Email
                  </p>
                  <a
                    href="mailto:dnk.hidayat@gmail.com"
                    className="text-sm font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition"
                  >
                    dnk.hidayat@gmail.com
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3 py-3">
                <School size={16} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Institution
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Vocational School of IPB University
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 py-3">
                <GraduationCap size={16} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Program
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Technology of Computer Engineering
                  </p>
                </div>
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Links">
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              <a
                href="https://www.linkedin.com/in/dankehidayat/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 py-3 hover:opacity-70 transition -mx-2 px-2 rounded-lg group"
              >
                <Globe size={16} className="text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                    LinkedIn
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    linkedin.com/in/dankehidayat
                  </p>
                </div>
                <ExternalLink
                  size={14}
                  className="text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition shrink-0"
                />
              </a>
              <a
                href="https://bsky.app/profile/dankehidayat.my.id"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 py-3 hover:opacity-70 transition -mx-2 px-2 rounded-lg group"
              >
                <Globe size={16} className="text-sky-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">
                    Bluesky
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    bsky.app/profile/dankehidayat.my.id
                  </p>
                </div>
                <ExternalLink
                  size={14}
                  className="text-gray-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition shrink-0"
                />
              </a>
              <a
                href="https://github.com/dankehidayat/selene"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 py-3 hover:opacity-70 transition -mx-2 px-2 rounded-lg group"
              >
                <Code size={16} className="text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    GitHub
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    github.com/dankehidayat/selene
                  </p>
                </div>
                <ExternalLink
                  size={14}
                  className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-white transition shrink-0"
                />
              </a>
            </div>
          </ChartCard>

          <ChartCard title="Why This Project Was Created">
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
              <p>
                This project was developed as part of the final assignment
                (Tugas Akhir) at the Computer Engineering Technology program,
                College of Vocational Studies, IPB University.
              </p>
              <p>
                Monitoring energy consumption and environmental conditions is
                essential for efficiency and comfort. The system combines fuzzy
                logic for intelligent classification with modern web
                technologies to provide actionable insights from IoT sensor
                data. All readings are stored in a time-series database with
                automated ingestion, making historical analysis fast and
                reliable.
              </p>
            </div>
          </ChartCard>
        </div>
      )}

      {activeTab === "acknowledgement" && (
        <div>
          <ChartCard title="Open Source Libraries & Tools">
            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium mb-6">
              Selene makes use of the following open-source libraries and tools.
              We are grateful to the maintainers and contributors of these
              projects.
            </p>
            <PackageTable
              packages={frontendPackages}
              title="Frontend Libraries"
            />
            <PackageTable
              packages={backendPackages}
              title="Backend & Database"
            />
            <PackageTable packages={iotPackages} title="IoT & Hardware" />
            <PackageTable packages={devPackages} title="Development Tools" />
          </ChartCard>
        </div>
      )}
      </div>
    </div>
  );
}
