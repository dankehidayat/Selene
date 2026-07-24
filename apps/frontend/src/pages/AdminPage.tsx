// apps/frontend/src/pages/AdminPage.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/services/auth";
import {
  Users,
  Activity,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Cpu,
  FileWarning,
  Upload,
  Clock,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { ChartCard } from "@/components/ChartCard";
import { UserManagement } from "@/components/UserManagement";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

type TabKey = "users" | "firmware" | "system";

interface FirmwareStatus {
  loading: boolean;
  message: string | null;
  error: string | null;
  otaSent: boolean;
}

interface OtaLogLine {
  t: string;
  level: "info" | "ok" | "warn" | "err";
  text: string;
}

interface OtaHistoryEntry {
  id: string;
  nodeId: string;
  filename: string;
  size: number;
  status: "pending" | "downloading" | "success" | "failed";
  error?: string;
  timestamp: string;
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function OtaStatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { icon: typeof CheckCircle2; color: string; bg: string; label: string }
  > = {
    pending: {
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/30",
      label: "Pending",
    },
    downloading: {
      icon: RefreshCw,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/30",
      label: "Downloading",
    },
    success: {
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/30",
      label: "Success",
    },
    failed: {
      icon: XCircle,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-900/30",
      label: "Failed",
    },
  };

  const { icon: Icon, color, bg, label } = config[status] || config.pending;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color} ${bg}`}
    >
      <Icon size={11} />
      {label}
    </span>
  );
}

export function AdminPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabKey>("users");
  const [selectedNode, setSelectedNode] = useState("");
  const [mqttNodes, setMqttNodes] = useState<
    { nodeId: string; lastSeen: string; messageCount: number }[]
  >([]);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [manualNode, setManualNode] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fwStatus, setFwStatus] = useState<FirmwareStatus>({
    loading: false,
    message: null,
    error: null,
    otaSent: false,
  });
  const [otaHistory, setOtaHistory] = useState<OtaHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [otaLog, setOtaLog] = useState<OtaLogLine[]>([]);
  const otaLogRef = useRef<HTMLDivElement>(null);

  if (user?.role !== "ADMIN") {
    navigate({ to: "/" });
    return null;
  }

  const appendLog = (level: OtaLogLine["level"], text: string) => {
    const t = new Date().toLocaleTimeString();
    setOtaLog((prev) => [...prev.slice(-200), { t, level, text }]);
  };

  useEffect(() => {
    otaLogRef.current?.scrollTo({ top: otaLogRef.current.scrollHeight });
  }, [otaLog]);

  const loadHistory = async () => {
    if (!token) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/firmware/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.history) setOtaHistory(data.history);
      return (data.history ?? []) as OtaHistoryEntry[];
    } catch {
      return [] as OtaHistoryEntry[];
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadNodes = async (
    historyHint?: OtaHistoryEntry[],
    opts?: { silent?: boolean },
  ) => {
    if (!token) return;
    const silent = opts?.silent ?? false;
    setNodesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/mqtt/nodes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`MQTT nodes HTTP ${res.status}`);
      const data = await res.json();
      const fromMqtt: {
        nodeId: string;
        lastSeen: string;
        messageCount: number;
      }[] = Array.isArray(data.nodes) ? data.nodes : [];

      const merged = new Map(fromMqtt.map((n) => [n.nodeId, n]));
      for (const h of historyHint ?? otaHistory) {
        if (h.nodeId && !merged.has(h.nodeId)) {
          merged.set(h.nodeId, {
            nodeId: h.nodeId,
            lastSeen: h.timestamp,
            messageCount: 0,
          });
        }
      }
      const nodes = Array.from(merged.values()).sort((a, b) =>
        a.lastSeen < b.lastSeen ? 1 : -1,
      );

      // Keep last-known nodes if refresh returns empty (in-memory map / brief blip)
      if (nodes.length === 0) {
        setMqttNodes((prev) => (prev.length > 0 ? prev : []));
        if (!silent) {
          appendLog(
            "warn",
            "No nodes from backend right now — keeping previous list if any.",
          );
        }
      } else {
        setMqttNodes(nodes);
        setSelectedNode((prev) => {
          if (
            prev &&
            prev !== "__manual__" &&
            nodes.some((n) => n.nodeId === prev)
          ) {
            return prev;
          }
          if (nodes.length > 0) return nodes[0].nodeId;
          return prev || "";
        });
        if (!silent) {
          appendLog(
            "info",
            `Discovered ${nodes.length} node(s): ${nodes.map((n) => n.nodeId).join(", ")}`,
          );
        }
      }
    } catch (e: any) {
      if (!silent) {
        appendLog(
          "err",
          `Node refresh failed: ${e?.message || "network error"}`,
        );
      }
      // Do not clear mqttNodes on error
    } finally {
      setNodesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "firmware" || !token) return;
    (async () => {
      setHistoryLoading(true);
      let history: OtaHistoryEntry[] = [];
      try {
        const res = await fetch(`${API_BASE}/firmware/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.history) {
          history = data.history;
          setOtaHistory(history);
        }
      } catch {
      } finally {
        setHistoryLoading(false);
      }
      await loadNodes(history, { silent: true });
    })();
  }, [activeTab, token]);

  const validateFile = (file: File): string | null => {
    if (!file.name.endsWith(".bin"))
      return "Only .bin firmware files are accepted.";
    if (file.size > 4 * 1024 * 1024) return "Firmware file must be under 4MB.";
    if (file.size === 0) return "File is empty.";
    return null;
  };

  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setFwStatus({ loading: false, message: null, error, otaSent: false });
      return;
    }
    setSelectedFile(file);
    setFwStatus({ loading: false, message: null, error: null, otaSent: false });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const targetNodeId =
    selectedNode === "__manual__" ||
    !selectedNode ||
    mqttNodes.length === 0
      ? manualNode.trim()
      : selectedNode.trim();

  const handleUpload = async () => {
    if (!selectedFile || !token) return;
    if (!targetNodeId) {
      setFwStatus({
        loading: false,
        message: null,
        error:
          "Select a target node discovered via MQTT, or enter a node ID manually.",
        otaSent: false,
      });
      return;
    }

    setFwStatus({ loading: true, message: null, error: null, otaSent: false });
    setOtaLog([]);
    appendLog("info", `Target node: ${targetNodeId}`);
    appendLog(
      "info",
      `Validating ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)…`,
    );

    try {
      const formData = new FormData();
      formData.append("firmware", selectedFile);
      formData.append("node_id", targetNodeId);

      appendLog("info", "Uploading binary to backend…");
      const res = await fetch(`${API_BASE}/firmware/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Upload failed");

      appendLog(
        "ok",
        `Stored on server (${data.filename || selectedFile.name}, ${((data.size || selectedFile.size) / 1024).toFixed(1)} KB). Expires in ~5 min.`,
      );

      if (data.otaCommandSent) {
        appendLog(
          "ok",
          `MQTT command published → selene/${targetNodeId}/command { command: "ota", url, size }`,
        );
        appendLog(
          "info",
          "Waiting for ESP32 to download firmware over HTTPS (if OTA handler is in firmware)…",
        );
        appendLog(
          "warn",
          "If the device has no OTA handler yet, it will ignore the command — serial/monitor will show nothing.",
        );
      } else {
        appendLog(
          "warn",
          "Firmware stored but MQTT command was NOT sent (broker disconnected).",
        );
      }

      setFwStatus({
        loading: false,
        message: data.message || `OTA initiated for ${targetNodeId}.`,
        error: null,
        otaSent: !!data.otaCommandSent,
      });
      setSelectedFile(null);
      await loadHistory();
      await loadNodes(undefined, { silent: true });

      // Poll history a few times for status transitions (pending → downloading → success/failed)
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        const hist = await loadHistory();
        const entry = hist.find((e) => e.nodeId === targetNodeId);
        if (!entry) continue;
        if (entry.status === "downloading") {
          appendLog("info", `Device is downloading firmware…`);
        } else if (entry.status === "success") {
          appendLog("ok", `OTA success reported by ${targetNodeId}.`);
          break;
        } else if (entry.status === "failed") {
          appendLog(
            "err",
            `OTA failed${entry.error ? `: ${entry.error}` : ""}.`,
          );
          break;
        }
      }
    } catch (err: any) {
      appendLog("err", err.message || "Upload failed");
      setFwStatus({
        loading: false,
        message: null,
        error: err.message || "Upload failed. Please try again.",
        otaSent: false,
      });
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFwStatus({ loading: false, message: null, error: null, otaSent: false });
  };

  const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
    { key: "users", label: "Users", icon: Users },
    { key: "firmware", label: "Firmware", icon: Cpu },
    { key: "system", label: "System", icon: Activity },
  ];

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Admin Tools
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
          Manage users, deploy firmware updates, and monitor system health
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
                activeTab === tab.key
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Users Tab ──────────────────────────────────── */}
      {activeTab === "users" && <UserManagement />}

      {/* ── Firmware Tab ───────────────────────────────── */}
      {activeTab === "firmware" && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upload Card */}
          <ChartCard title="OTA Firmware Update">
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-900 dark:text-white">
                    Target Node
                  </label>
                  <button
                    type="button"
                    onClick={() => loadNodes(undefined, { silent: false })}
                    disabled={nodesLoading || fwStatus.loading}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition disabled:opacity-50"
                  >
                    <RefreshCw
                      size={11}
                      className={nodesLoading ? "animate-spin" : ""}
                    />
                    Refresh nodes
                  </button>
                </div>
                <select
                  value={
                    mqttNodes.some((n) => n.nodeId === selectedNode)
                      ? selectedNode
                      : selectedNode === "__manual__" || mqttNodes.length === 0
                        ? selectedNode || ""
                        : selectedNode || mqttNodes[0]?.nodeId || ""
                  }
                  onChange={(e) => setSelectedNode(e.target.value)}
                  disabled={fwStatus.loading}
                  className="w-full text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition disabled:opacity-50"
                >
                  {mqttNodes.length === 0 && (
                    <option value="">
                      {nodesLoading
                        ? "Discovering nodes…"
                        : "No nodes seen yet — enter ID below"}
                    </option>
                  )}
                  {mqttNodes.map((n) => (
                    <option key={n.nodeId} value={n.nodeId}>
                      {n.nodeId}
                      {n.lastSeen
                        ? ` · last seen ${new Date(n.lastSeen).toLocaleString()}`
                        : ""}
                    </option>
                  ))}
                  <option value="__manual__">Other (type node ID)…</option>
                </select>
                {selectedNode === "__manual__" || mqttNodes.length === 0 ? (
                  <input
                    type="text"
                    value={manualNode}
                    onChange={(e) => {
                      setManualNode(e.target.value);
                      if (mqttNodes.length === 0) setSelectedNode("__manual__");
                    }}
                    placeholder="e.g. office-main"
                    disabled={fwStatus.loading}
                    className="mt-2 w-full text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition disabled:opacity-50"
                  />
                ) : null}
                <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  Nodes appear after the backend receives MQTT telemetry on{" "}
                  <code className="text-[10px]">selene/&lt;nodeId&gt;/telemetry</code>
                  . The ID must match Arduino{" "}
                  <code className="text-[10px]">NODE_ID</code> (e.g.{" "}
                  <code className="text-[10px]">office-main</code>).
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-900 dark:text-white mb-1.5 block">
                  Firmware Binary (.bin)
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl transition cursor-pointer
                    ${
                      isDragOver
                        ? "border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500"
                    }
                    ${fwStatus.loading ? "opacity-50 pointer-events-none" : ""}
                  `}
                >
                  {selectedFile ? (
                    <div className="text-center px-4">
                      <FileWarning
                        size={32}
                        className="text-blue-500 mx-auto mb-2"
                      />
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[250px]">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          clearFile();
                        }}
                        className="mt-2 text-xs font-medium text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="text-center px-4">
                      {fwStatus.loading ? (
                        <Spinner className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                      ) : (
                        <Upload
                          size={32}
                          className="text-gray-400 mx-auto mb-2"
                        />
                      )}
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        Drop .bin file here or click to browse
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Max 4MB
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".bin"
                    disabled={fwStatus.loading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {fwStatus.error && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800">
                  <AlertCircle
                    size={16}
                    className="text-red-500 shrink-0 mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                      Upload Failed
                    </p>
                    <p className="text-sm text-red-500 dark:text-red-400 mt-0.5">
                      {fwStatus.error}
                    </p>
                  </div>
                </div>
              )}

              {fwStatus.message && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800">
                  <CheckCircle2
                    size={16}
                    className="text-emerald-500 shrink-0 mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {fwStatus.otaSent ? "OTA Deployed" : "Firmware Uploaded"}
                    </p>
                    <p className="text-sm text-emerald-500 dark:text-emerald-400 mt-0.5">
                      {fwStatus.message}
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!selectedFile || fwStatus.loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-40 transition active:scale-[0.98]"
              >
                {fwStatus.loading ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload size={15} />
                    Upload & Deploy
                  </>
                )}
              </button>

              <p className="text-xs text-gray-400 dark:text-gray-500 text-center leading-relaxed">
                Do not power off the ESP32 during a real OTA flash. Progress
                below is server-side; device serial is the source of truth for
                flash success.
              </p>

              {/* Terminal-style activity log */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Terminal size={13} className="text-gray-400" />
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">
                    OTA activity log
                  </span>
                </div>
                <div
                  ref={otaLogRef}
                  className="h-40 overflow-y-auto rounded-xl bg-gray-950 text-[11px] font-mono leading-relaxed px-3 py-2.5 border border-gray-800"
                >
                  {otaLog.length === 0 ? (
                    <p className="text-gray-500">
                      Idle — upload a .bin to see server steps here.
                    </p>
                  ) : (
                    otaLog.map((line, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-gray-500 shrink-0">{line.t}</span>
                        <span
                          className={
                            line.level === "ok"
                              ? "text-emerald-400"
                              : line.level === "err"
                                ? "text-red-400"
                                : line.level === "warn"
                                  ? "text-amber-400"
                                  : "text-gray-300"
                          }
                        >
                          {line.text}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </ChartCard>

          {/* Info & History */}
          <div className="space-y-6">
            <ChartCard title="How OTA Works">
              <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                <div className="flex gap-3">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-600 dark:text-gray-400 shrink-0">
                    1
                  </span>
                  <p>
                    Export compiled{" "}
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                      .bin
                    </code>{" "}
                    from Arduino IDE (Sketch → Export compiled Binary).
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-600 dark:text-gray-400 shrink-0">
                    2
                  </span>
                  <p>
                    Upload here. Backend stores the binary in memory (~5 min)
                    and publishes MQTT{" "}
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                      selene/&lt;nodeId&gt;/command
                    </code>{" "}
                    with{" "}
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                      {`{ command: "ota", url, size }`}
                    </code>
                    .
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-600 dark:text-gray-400 shrink-0">
                    3
                  </span>
                  <p>
                    ESP32 must <strong>subscribe</strong> to that command topic
                    and run an HTTP(S) update (e.g.{" "}
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                      HTTPUpdate
                    </code>
                    ) from the URL. Without that code in your sketch, the device
                    will ignore the command — UI cannot force a flash.
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-600 dark:text-gray-400 shrink-0">
                    4
                  </span>
                  <p>
                    On download, status becomes <em>downloading</em>. Optional{" "}
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                      POST /api/firmware/result
                    </code>{" "}
                    reports success/fail. Binary is cleared after download or
                    expiry.
                  </p>
                </div>
              </div>
            </ChartCard>

            <ChartCard title="Recent OTA History">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="h-5 w-5 text-gray-400" />
                </div>
              ) : otaHistory.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                  No OTA updates yet
                </p>
              ) : (
                <div className="space-y-2">
                  {otaHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Cpu size={15} className="text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {entry.nodeId}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {entry.filename} · {(entry.size / 1024).toFixed(1)}{" "}
                            KB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {new Date(entry.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <OtaStatusBadge status={entry.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          </div>
        </div>
      )}

      {/* ── System Tab ─────────────────────────────────── */}
      {activeTab === "system" && (
        <ChartCard title="System Information">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Backend Status
              </span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Online
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                MQTT Broker
              </span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Database
              </span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Version
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                0.1.0
              </span>
            </div>
          </div>
        </ChartCard>
      )}
    </div>
  );
}
