// apps/frontend/src/pages/Glossary.tsx
import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, Plus, X, Trash2 } from "lucide-react";
import { ChartCard } from "@/components/ChartCard";
import { useAuth } from "@/services/auth";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "/api";

interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  category: string;
}

const defaultTerms: GlossaryTerm[] = [
  {
    id: "1",
    term: "AC Voltage",
    definition:
      "Alternating Current voltage measured in volts (V). The electrical potential difference in an AC circuit.",
    category: "Electrical",
  },
  {
    id: "2",
    term: "AC Current",
    definition:
      "Alternating Current measured in amperes (A). The flow of electric charge in an AC circuit.",
    category: "Electrical",
  },
  {
    id: "3",
    term: "AC Power",
    definition:
      "Active power measured in watts (W). The actual power consumed by electrical devices.",
    category: "Electrical",
  },
  {
    id: "4",
    term: "Cos Phi",
    definition:
      "Power factor representing the phase difference between voltage and current. Values range from 0 to 1.",
    category: "Electrical",
  },
  {
    id: "5",
    term: "Apparent Power",
    definition:
      "The product of voltage and current measured in volt-amperes (VA). Includes both active and reactive power.",
    category: "Electrical",
  },
  {
    id: "6",
    term: "Reactive Power",
    definition:
      "Power that oscillates between source and load measured in volt-amperes reactive (VAR).",
    category: "Electrical",
  },
  {
    id: "7",
    term: "Frequency",
    definition:
      "The rate at which AC current changes direction, measured in hertz (Hz). Standard in Indonesia is 50 Hz.",
    category: "Electrical",
  },
  {
    id: "8",
    term: "Fuzzy Logic",
    definition:
      "A computing approach based on degrees of truth rather than binary true/false. Used for energy and climate classification.",
    category: "Computing",
  },
  {
    id: "9",
    term: "DHT11",
    definition:
      "A basic digital temperature and humidity sensor used in the monitoring system.",
    category: "Hardware",
  },
  {
    id: "10",
    term: "PZEM-004T",
    definition:
      "An electrical measurement module for AC voltage, current, power, frequency, and power factor.",
    category: "Hardware",
  },
  {
    id: "11",
    term: "ESP32",
    definition:
      "A low-cost, low-power microcontroller with integrated Wi-Fi and Bluetooth capabilities.",
    category: "Hardware",
  },
  {
    id: "12",
    term: "Mamdani Inference",
    definition:
      "A fuzzy logic inference method using fuzzy sets for both inputs and outputs. Used in the 15-rule energy and 14-rule climate classification systems.",
    category: "Computing",
  },
  {
    id: "13",
    term: "Bland-Altman Plot",
    definition:
      "A statistical method for comparing two measurement techniques by plotting the difference against the mean.",
    category: "Statistics",
  },
  {
    id: "14",
    term: "Box Plot",
    definition:
      "A standardized way of displaying data distribution based on minimum, first quartile, median, third quartile, and maximum.",
    category: "Statistics",
  },
  {
    id: "15",
    term: "Decision Surface",
    definition:
      "A visualization showing how a classification model divides the input space into different output regions.",
    category: "Computing",
  },
  {
    id: "16",
    term: "Membership Function",
    definition:
      "A curve that defines how each point in the input space is mapped to a membership value between 0 and 1 in fuzzy logic.",
    category: "Computing",
  },
  {
    id: "17",
    term: "Power Factor Correction",
    definition:
      "A technique to improve power factor by reducing reactive power, typically using capacitors.",
    category: "Electrical",
  },
  {
    id: "18",
    term: "Degree-Hours",
    definition:
      "A measure of heating or cooling demand calculated by integrating temperature above a baseline over time.",
    category: "Climate",
  },
  {
    id: "19",
    term: "Dew Point",
    definition:
      "The temperature at which air becomes saturated with water vapor and condensation begins to form.",
    category: "Climate",
  },
  {
    id: "20",
    term: "Correlation Coefficient",
    definition:
      "A statistical measure (r) indicating the strength and direction of a linear relationship between two variables.",
    category: "Statistics",
  },
  {
    id: "21",
    term: "TimescaleDB",
    definition:
      "An open-source time-series database extension for PostgreSQL. Optimized for storing and querying sensor readings with automatic time-based partitioning.",
    category: "Database",
  },
  {
    id: "22",
    term: "Hypertable",
    definition:
      "A TimescaleDB feature that automatically partitions large tables by time into chunks for faster queries and efficient storage.",
    category: "Database",
  },
  {
    id: "23",
    term: "Blynk",
    definition:
      "An IoT platform that enables communication between microcontrollers and cloud services. Used as the bridge between the ESP32 sensor and the Selene backend.",
    category: "IoT",
  },
  {
    id: "24",
    term: "JWT",
    definition:
      "JSON Web Token — a compact, URL-safe means of representing claims between parties. Used for authentication with 7-day expiry.",
    category: "Computing",
  },
  {
    id: "25",
    term: "Linear Regression",
    definition:
      "A machine learning algorithm that models the relationship between variables by fitting a linear equation. Used in the forecasting engine for trend prediction.",
    category: "Machine Learning",
  },
  {
    id: "26",
    term: "Exponential Smoothing",
    definition:
      "A time-series forecasting method that applies decreasing weights to older observations. Used for short-term energy and climate predictions.",
    category: "Machine Learning",
  },
  {
    id: "27",
    term: "Ensemble Forecast",
    definition:
      "A prediction method that combines multiple models (linear regression, pattern matching, exponential smoothing) weighted by forecast horizon for improved accuracy.",
    category: "Machine Learning",
  },
  {
    id: "28",
    term: "Confidence Band",
    definition:
      "A shaded range around a forecast line representing the prediction uncertainty. Wider bands indicate lower confidence in the prediction.",
    category: "Statistics",
  },
  {
    id: "29",
    term: "Swagger",
    definition:
      "An open-source framework for designing and documenting REST APIs. Selene uses it to provide interactive API documentation at /docs.",
    category: "Computing",
  },
  {
    id: "30",
    term: "Time-Weighted Integration",
    definition:
      "A method for calculating energy consumption by multiplying average power between readings by the time interval. Prevents overcounting with frequent sensor readings.",
    category: "Electrical",
  },
];

export function Glossary() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTerm, setNewTerm] = useState("");
  const [newDefinition, setNewDefinition] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/glossary`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setTerms(data);
        } else {
          setTerms(defaultTerms);
        }
      })
      .catch(() => setTerms(defaultTerms))
      .finally(() => setLoading(false));
  }, []);

  const filteredTerms = terms.filter(
    (t) =>
      t.term.toLowerCase().includes(search.toLowerCase()) ||
      t.definition.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase()),
  );

  const addTerm = async () => {
    if (!newTerm || !newDefinition || !token) return;
    try {
      const res = await fetch(`${API_BASE}/glossary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          term: newTerm,
          definition: newDefinition,
          category: newCategory || "General",
        }),
      });
      const created = await res.json();
      setTerms([...terms, created]);
    } catch {
      setTerms([
        ...terms,
        {
          id: Date.now().toString(),
          term: newTerm,
          definition: newDefinition,
          category: newCategory || "General",
        },
      ]);
    }
    setNewTerm("");
    setNewDefinition("");
    setNewCategory("");
    setDialogOpen(false);
  };

  const deleteTerm = async (id: string) => {
    if (!token) return;
    try {
      await fetch(`${API_BASE}/glossary/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    setTerms(terms.filter((t) => t.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto w-full min-w-0 overflow-x-hidden">
      <div className="text-center mb-6 px-1">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Glossary
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
          Technical terms and definitions
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-6 w-full max-w-lg mx-auto min-w-0">
        <div className="flex-1 min-w-0 flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 text-sm text-gray-900 dark:text-white bg-transparent outline-none placeholder:text-gray-400"
            placeholder="Search glossary..."
          />
        </div>
        {isAdmin && (
          <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
            <Dialog.Trigger asChild>
              <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 dark:text-gray-900 dark:bg-white dark:hover:bg-gray-100 rounded-xl transition shrink-0 w-full sm:w-auto">
                <Plus size={14} /> Add Term
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-gray-900/30 dark:bg-black/50 z-40" />
              <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl p-6 w-full max-w-md z-50">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                    Add Glossary Term
                  </Dialog.Title>
                  <Dialog.Close className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <X size={18} />
                  </Dialog.Close>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-900 dark:text-white mb-1 block">
                      Term
                    </label>
                    <input
                      type="text"
                      value={newTerm}
                      onChange={(e) => setNewTerm(e.target.value)}
                      className="w-full text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition"
                      placeholder="e.g., Voltage"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-900 dark:text-white mb-1 block">
                      Definition
                    </label>
                    <textarea
                      value={newDefinition}
                      onChange={(e) => setNewDefinition(e.target.value)}
                      className="w-full text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition resize-none h-24"
                      placeholder="Enter definition..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-900 dark:text-white mb-1 block">
                      Category
                    </label>
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition"
                      placeholder="e.g., Electrical"
                    />
                  </div>
                  <button
                    onClick={addTerm}
                    disabled={!newTerm || !newDefinition}
                    className="w-full text-sm font-semibold rounded-xl px-4 py-2.5 transition text-white bg-gray-900 hover:bg-gray-800 dark:text-gray-900 dark:bg-white dark:hover:bg-gray-100 disabled:opacity-40"
                  >
                    Add Term
                  </button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </div>

      <ChartCard title="All Terms">
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400 font-medium">
            Loading...
          </div>
        ) : (
          <div className="overflow-x-auto max-w-full -mx-1 px-1">
            <table className="w-full text-sm min-w-0">
              <thead>
                <tr className="text-left text-xs border-b border-gray-200 dark:border-gray-700">
                  <th className="font-semibold py-3 px-2 text-gray-900 dark:text-white w-[28%] sm:w-auto">
                    Term
                  </th>
                  <th className="font-semibold py-3 px-2 text-gray-900 dark:text-white">
                    Definition
                  </th>
                  <th className="font-semibold py-3 px-2 text-gray-900 dark:text-white hidden sm:table-cell">
                    Category
                  </th>
                  {isAdmin && (
                    <th className="font-semibold py-3 px-2 w-10"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredTerms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 4 : 3}
                      className="py-8 text-center text-sm text-gray-500 dark:text-gray-400 font-medium"
                    >
                      No terms found
                    </td>
                  </tr>
                ) : (
                  filteredTerms.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="py-3 px-2 text-gray-900 dark:text-white font-semibold align-top break-words">
                        {t.term}
                        <span className="sm:hidden block mt-1">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            {t.category}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-2 text-gray-600 dark:text-gray-400 align-top break-words">
                        {t.definition}
                      </td>
                      <td className="py-3 px-2 hidden sm:table-cell align-top">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          {t.category}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-2 align-top">
                          <button
                            onClick={() => deleteTerm(t.id)}
                            className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
