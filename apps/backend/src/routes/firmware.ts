// apps/backend/src/routes/firmware.ts
import type { FastifyInstance, FastifyRequest } from "fastify";
import { authenticate, requireAdmin } from "../middleware/auth";
import { sendOtaCommand, rememberNode } from "../mqtt";

// ── In-memory firmware storage ───────────────────────────
interface PendingFirmware {
  buffer: Buffer;
  nodeId: string;
  filename: string;
  size: number;
  uploadedAt: Date;
  expiresAt: Date;
  /** How many times the OTA MQTT command was published */
  publishCount: number;
  lastPublishedAt: Date | null;
  /** First byte served to a device (HTTPS download started) */
  downloadStartedAt: Date | null;
}

const firmwareStore = new Map<string, PendingFirmware>();

/** Keep binaries available long enough for slow Wi‑Fi OTA + retries */
const FIRMWARE_TTL_MS = 15 * 60 * 1000;
/** Re-publish MQTT ota command while binary is still pending */
const OTA_REPUBLISH_MS = 12_000;
const OTA_REPUBLISH_MAX = 25; // ~5 minutes of retries

// Clean up expired firmware every minute
setInterval(() => {
  const now = new Date();
  for (const [key, fw] of firmwareStore) {
    if (now > fw.expiresAt) {
      firmwareStore.delete(key);
      console.log(`[Firmware] Expired firmware cleared for ${fw.nodeId}`);
    }
  }
}, 60_000);

// Re-push OTA MQTT commands so a briefly-busy ESP still gets the update.
// Keep publishing even after a download GET: a browser/curl probe or a failed
// ESP attempt should not silence the device forever.
setInterval(() => {
  const now = Date.now();
  for (const fw of firmwareStore.values()) {
    if (now > fw.expiresAt.getTime()) continue;
    if (fw.publishCount >= OTA_REPUBLISH_MAX) continue;
    const last = fw.lastPublishedAt?.getTime() ?? 0;
    if (now - last < OTA_REPUBLISH_MS) continue;

    const downloadUrl = publicDownloadUrl(fw.nodeId);
    const sent = sendOtaCommand(fw.nodeId, downloadUrl, fw.size);
    if (sent) {
      fw.publishCount += 1;
      fw.lastPublishedAt = new Date();
      console.log(
        `[Firmware] Re-published OTA to ${fw.nodeId} (attempt ${fw.publishCount}/${OTA_REPUBLISH_MAX})` +
          (fw.downloadStartedAt ? " [download already hit once]" : ""),
      );
    }
  }
}, 5_000);

// ── OTA History ──────────────────────────────────────────
interface OtaEntry {
  id: string;
  nodeId: string;
  filename: string;
  size: number;
  status: "pending" | "downloading" | "success" | "failed";
  error?: string;
  timestamp: string;
}

const otaHistory: OtaEntry[] = [];

function publicDownloadUrl(nodeId: string) {
  const base =
    process.env.PUBLIC_API_BASE?.replace(/\/$/, "") ||
    "https://selene.dankehidayat.my.id/api";
  return `${base}/firmware/download/${encodeURIComponent(nodeId)}`;
}

function publicCheckUrl(nodeId: string) {
  const base =
    process.env.PUBLIC_API_BASE?.replace(/\/$/, "") ||
    "https://selene.dankehidayat.my.id/api";
  return `${base}/firmware/check/${encodeURIComponent(nodeId)}`;
}

export async function registerFirmwareRoutes(app: FastifyInstance) {
  // ── Upload firmware (admin only) ──────────────────────
  app.post(
    "/api/firmware/upload",
    {
      preHandler: [authenticate, requireAdmin],
    },
    async (request: FastifyRequest, reply) => {
      let buffer: Buffer | null = null;
      let filename = "firmware.bin";
      let nodeId = "office-main";

      try {
        const parts = request.parts();

        for await (const part of parts) {
          if (part.type === "file") {
            filename = part.filename || "firmware.bin";
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(
                Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)),
              );
            }
            buffer = Buffer.concat(chunks);
          } else if (part.type === "field" && part.fieldname === "node_id") {
            const value = String(part.value ?? "").trim();
            if (value) nodeId = value;
          }
        }
      } catch (err: any) {
        return reply
          .code(400)
          .send({ error: "Failed to parse upload: " + err.message });
      }

      if (!buffer || buffer.length === 0) {
        return reply
          .code(400)
          .send({ error: "No file uploaded or file is empty" });
      }

      if (!filename.endsWith(".bin")) {
        return reply
          .code(400)
          .send({ error: "Only .bin firmware files are accepted" });
      }

      if (buffer.length < 4 || buffer[0] !== 0xe9) {
        return reply
          .code(400)
          .send({ error: "Invalid ESP32 firmware file. Missing magic byte." });
      }

      const maxSize = 4 * 1024 * 1024;
      if (buffer.length > maxSize) {
        return reply.code(400).send({ error: "Firmware exceeds 4MB limit" });
      }

      const id = `${nodeId}-${Date.now()}`;
      const now = new Date();
      firmwareStore.set(nodeId, {
        buffer,
        nodeId,
        filename,
        size: buffer.length,
        uploadedAt: now,
        expiresAt: new Date(now.getTime() + FIRMWARE_TTL_MS),
        publishCount: 0,
        lastPublishedAt: null,
        downloadStartedAt: null,
      });

      otaHistory.unshift({
        id,
        nodeId,
        filename,
        size: buffer.length,
        status: "pending",
        timestamp: now.toISOString(),
      });
      if (otaHistory.length > 50) otaHistory.pop();

      console.log(
        `[Firmware] ${filename} (${(buffer.length / 1024).toFixed(1)}KB) uploaded for ${nodeId}`,
      );
      rememberNode(nodeId);

      const downloadUrl = publicDownloadUrl(nodeId);
      const sent = sendOtaCommand(nodeId, downloadUrl, buffer.length);
      const fw = firmwareStore.get(nodeId);
      if (fw && sent) {
        fw.publishCount = 1;
        fw.lastPublishedAt = new Date();
      }

      return {
        success: true,
        id,
        nodeId,
        filename,
        size: buffer.length,
        downloadUrl,
        checkUrl: publicCheckUrl(nodeId),
        otaCommandSent: sent,
        message: sent
          ? `OTA command sent to ${nodeId}. Device will download over HTTPS (retries for ~5 min if offline briefly).`
          : `Firmware stored. MQTT not connected — device can still pull via /api/firmware/check/${nodeId}, or OTA will retry when the broker is back.`,
      };
    },
  );

  /**
   * Device pull API (no auth): ESP can poll after MQTT connect or on a timer.
   * Returns pending download URL if a binary is stored for this node.
   */
  app.get("/api/firmware/check/:nodeId", async (request) => {
    const { nodeId } = request.params as { nodeId: string };
    const fw = firmwareStore.get(nodeId);
    if (!fw || new Date() > fw.expiresAt) {
      return {
        pending: false,
        nodeId,
      };
    }
    return {
      pending: true,
      nodeId,
      filename: fw.filename,
      size: fw.size,
      url: publicDownloadUrl(nodeId),
      expiresAt: fw.expiresAt.toISOString(),
    };
  });

  // ── ESP32 downloads firmware ──────────────────────────
  app.get("/api/firmware/download/:nodeId", async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const fw = firmwareStore.get(nodeId);

    if (!fw || new Date() > fw.expiresAt) {
      if (fw) firmwareStore.delete(nodeId);
      return reply
        .code(404)
        .send({ error: "No firmware pending for this node" });
    }

    const entry = otaHistory.find(
      (e) =>
        e.nodeId === nodeId &&
        (e.status === "pending" || e.status === "downloading"),
    );
    if (entry) entry.status = "downloading";
    if (!fw.downloadStartedAt) fw.downloadStartedAt = new Date();

    console.log(
      `[Firmware] ${nodeId} downloading ${fw.filename} (${(fw.size / 1024).toFixed(1)}KB)`,
    );

    reply.header("Content-Type", "application/octet-stream");
    reply.header(
      "Content-Disposition",
      `attachment; filename="${fw.filename}"`,
    );
    reply.header("Content-Length", String(fw.size));
    // Help dumb HTTP clients; avoid intermediary transforms
    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");

    // Keep the binary available for a while so a flaky ESP can retry the GET.
    // Mark history success once the full response has been written; device may
    // reboot without POSTing /firmware/result.
    const payload = fw.buffer;
    const markDelivered = () => {
      const hist = otaHistory.find(
        (e) =>
          e.nodeId === nodeId &&
          (e.status === "pending" || e.status === "downloading"),
      );
      if (hist && hist.status !== "failed") {
        hist.status = "success";
        console.log(
          `[Firmware] ${nodeId} full binary delivered (${(fw.size / 1024).toFixed(1)}KB) → status=success`,
        );
      }
      // Do NOT delete immediately — leave until TTL or explicit result so
      // HTTPUpdate retries still find the file.
    };
    reply.raw.once("finish", markDelivered);

    return payload;
  });

  // ── ESP32 reports OTA result (optional; download finish also marks success) ──
  app.post("/api/firmware/result", async (request) => {
    const body = (request.body || {}) as {
      nodeId?: string;
      success?: boolean;
      error?: string;
    };
    const nodeId = body.nodeId;
    if (!nodeId) {
      return { acknowledged: false, error: "nodeId required" };
    }
    const success = body.success !== false;
    const error = body.error;

    console.log(
      `[Firmware] OTA result from device ${nodeId}: ${success ? "SUCCESS" : "FAILED"}${error ? `: ${error}` : ""}`,
    );

    const entry = otaHistory.find(
      (e) =>
        e.nodeId === nodeId &&
        (e.status === "pending" ||
          e.status === "downloading" ||
          e.status === "success"),
    );
    if (entry) {
      // Device can still override success→failed if flash fails after download
      if (!success) {
        entry.status = "failed";
        if (error) entry.error = error;
      } else if (entry.status !== "failed") {
        entry.status = "success";
      }
    }

    // On definitive result, drop the binary
    if (firmwareStore.has(nodeId)) {
      firmwareStore.delete(nodeId);
    }

    return { acknowledged: true };
  });

  // ── Get OTA history (admin only) ──────────────────────
  app.get(
    "/api/firmware/history",
    {
      preHandler: [authenticate, requireAdmin],
    },
    async () => {
      return { history: otaHistory.slice(0, 20) };
    },
  );

  // ── Get pending firmware info ─────────────────────────
  app.get(
    "/api/firmware/pending",
    {
      preHandler: [authenticate, requireAdmin],
    },
    async () => {
      const pending: any[] = [];
      for (const [nodeId, fw] of firmwareStore) {
        pending.push({
          nodeId: fw.nodeId,
          filename: fw.filename,
          size: fw.size,
          uploadedAt: fw.uploadedAt.toISOString(),
          expiresAt: fw.expiresAt.toISOString(),
          publishCount: fw.publishCount,
          lastPublishedAt: fw.lastPublishedAt?.toISOString() ?? null,
          downloadStartedAt: fw.downloadStartedAt?.toISOString() ?? null,
        });
      }
      return { pending };
    },
  );

  // ── Cancel pending firmware ───────────────────────────
  app.delete(
    "/api/firmware/cancel/:nodeId",
    {
      preHandler: [authenticate, requireAdmin],
    },
    async (request, reply) => {
      const { nodeId } = request.params as { nodeId: string };

      if (firmwareStore.has(nodeId)) {
        firmwareStore.delete(nodeId);
        return { success: true, message: `Cancelled OTA for ${nodeId}` };
      }

      return reply
        .code(404)
        .send({ error: "No pending firmware for this node" });
    },
  );
}
