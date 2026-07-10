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
} from "lucide-react";
import { ChartCard } from "@/components/ChartCard";

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
    description: "Screenshots with JavaScript using HTML5 Canvas",
  },
  {
    name: "file-saver",
    version: "^2.0.5",
    license: "MIT",
    url: "https://github.com/eligrey/FileSaver.js",
    description: "Save files on the client-side",
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
    version: "^1.3.5",
    license: "MIT",
    url: "https://bun.sh",
    description: "Fast all-in-one JavaScript runtime & package manager",
  },
  {
    name: "@prisma/client",
    version: "^6.19.3",
    license: "Apache-2.0",
    url: "https://www.prisma.io",
    description: "Next-generation ORM for TypeScript & Node.js",
  },
  {
    name: "Prisma CLI",
    version: "^6.19.3",
    license: "Apache-2.0",
    url: "https://www.prisma.io",
    description: "Database management and migration tools",
  },
  {
    name: "bcryptjs",
    version: "^2.4.3",
    license: "MIT",
    url: "https://github.com/dcodeIO/bcrypt.js",
    description: "Password hashing library",
  },
  {
    name: "jsonwebtoken",
    version: "^9.0.2",
    license: "MIT",
    url: "https://github.com/auth0/node-jsonwebtoken",
    description: "JSON Web Token implementation",
  },
  {
    name: "@fastify/cors",
    version: "^9.0.1",
    license: "MIT",
    url: "https://github.com/fastify/fastify-cors",
    description: "CORS plugin for Fastify",
  },
  {
    name: "PostgreSQL",
    version: "16.x",
    license: "PostgreSQL",
    url: "https://www.postgresql.org",
    description: "Advanced open-source relational database",
  },
];

const iotPackages: PackageInfo[] = [
  {
    name: "ESP32",
    version: "—",
    license: "Open Source",
    url: "https://www.espressif.com",
    description: "Low-cost, low-power microcontroller with Wi-Fi & Bluetooth",
  },
  {
    name: "PZEM-004T",
    version: "V3.0",
    license: "Hardware",
    url: "https://innovatorsguru.com/pzem-004t",
    description: "AC electrical measurement module",
  },
  {
    name: "DHT11",
    version: "—",
    license: "Hardware",
    url: "https://www.mouser.com/datasheet/2/758/DHT11-Technical-Data-Sheet-Translated-Version-1143054.pdf",
    description: "Basic digital temperature and humidity sensor",
  },
  {
    name: "Arduino Framework",
    version: "—",
    license: "LGPL",
    url: "https://www.arduino.cc",
    description: "Open-source electronics prototyping platform",
  },
  {
    name: "Blynk IoT",
    version: "—",
    license: "AGPL-3.0",
    url: "https://blynk.io",
    description: "IoT platform for connecting devices to the cloud",
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Impressum
        </h2>
        <p className="text-sm text-gray-900 dark:text-white mt-1 font-medium">
          About this project and its creator
        </p>
      </div>

      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {(["about", "acknowledgement"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${activeTab === tab ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"}`}
            >
              {tab === "about" ? "About Selene" : "Acknowledgement"}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "about" && (
        <div className="space-y-6 max-w-2xl mx-auto">
          <ChartCard title="Project Information">
            <div className="space-y-4">
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                Selene
              </p>
              <p className="text-sm text-gray-900 dark:text-white font-medium">
                A real-time energy and climate monitoring dashboard for
                ESP32-based IoT sensors. Built with React, TypeScript, Fastify,
                and PostgreSQL.
              </p>
            </div>
          </ChartCard>

          <ChartCard title="Created By">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                  <User size={18} className="text-gray-600 dark:text-white" />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">
                    Danke Hidayat
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                    Author & Developer
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                  <Mail size={18} className="text-gray-600 dark:text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Email
                  </p>
                  <a
                    href="mailto:dnk.hidayat@gmail.com"
                    className="text-sm text-gray-900 dark:text-white font-medium hover:text-blue-600 dark:hover:text-blue-400 transition"
                  >
                    dnk.hidayat@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                  <School size={18} className="text-gray-600 dark:text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Institution
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white font-medium">
                    Vocational School of IPB University
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                  <GraduationCap
                    size={18}
                    className="text-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Program
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white font-medium">
                    Technology of Computer Engineering
                  </p>
                </div>
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Links">
            <div className="space-y-3">
              <a
                href="https://www.linkedin.com/in/dankehidayat/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition group"
              >
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                  <Globe
                    size={18}
                    className="text-blue-600 dark:text-blue-400"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                    LinkedIn
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    linkedin.com/in/dankehidayat
                  </p>
                </div>
                <ExternalLink
                  size={14}
                  className="text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition ml-auto"
                />
              </a>

              <a
                href="https://bsky.app/profile/dankehidayat.my.id"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition group"
              >
                <div className="h-10 w-10 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center shrink-0">
                  <Globe size={18} className="text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">
                    Bluesky
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    bsky.app/profile/dankehidayat.my.id
                  </p>
                </div>
                <ExternalLink
                  size={14}
                  className="text-gray-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition ml-auto"
                />
              </a>

              <a
                href="https://github.com/dankehidayat/selene"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition group"
              >
                <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <Code size={18} className="text-gray-700 dark:text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-gray-900 transition">
                    GitHub
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    github.com/dankehidayat/selene
                  </p>
                </div>
                <ExternalLink
                  size={14}
                  className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-white transition ml-auto"
                />
              </a>
            </div>
          </ChartCard>

          <ChartCard title="Academic Context">
            <div className="space-y-3 text-sm text-gray-900 dark:text-white font-medium">
              <p>
                This project was developed as part of the final assignment
                (Tugas Akhir) at the Computer Engineering Technology program,
                College of Vocational Studies, IPB University.
              </p>
              <p>
                The system implements fuzzy logic for energy consumption
                classification and provides comprehensive analytics for
                monitoring electrical parameters and environmental conditions.
              </p>
            </div>
          </ChartCard>
        </div>
      )}

      {activeTab === "acknowledgement" && (
        <div>
          <ChartCard title="Open Source Libraries & Tools">
            <p className="text-sm text-gray-900 dark:text-white font-medium mb-6">
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
  );
}
