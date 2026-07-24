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
}

const firmwareStore = new Map<string, PendingFirmware>();

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
          if (part.type === "file" && (part as any).file) {
            filename = part.filename || "firmware.bin";
            const chunks: Buffer[] = [];
            for await (const chunk of (part as any).file) {
              chunks.push(
                Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)),
              );
            }
            buffer = Buffer.concat(chunks);
          } else if (part.fieldname === "node_id") {
            let value = "";
            for await (const chunk of (part as any).file || []) {
              value += String(chunk);
            }
            if (value) nodeId = value.trim();
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
      firmwareStore.set(nodeId, {
        buffer,
        nodeId,
        filename,
        size: buffer.length,
        uploadedAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      otaHistory.unshift({
        id,
        nodeId,
        filename,
        size: buffer.length,
        status: "pending",
        timestamp: new Date().toISOString(),
      });
      if (otaHistory.length > 50) otaHistory.pop();

      console.log(
        `[Firmware] ${filename} (${(buffer.length / 1024).toFixed(1)}KB) uploaded for ${nodeId}`,
      );
      rememberNode(nodeId);

      const downloadUrl = `https://selene.dankehidayat.my.id/api/firmware/download/${nodeId}`;
      const sent = sendOtaCommand(nodeId, downloadUrl, buffer.length);

      return {
        success: true,
        id,
        nodeId,
        filename,
        size: buffer.length,
        otaCommandSent: sent,
        message: sent
          ? `OTA command sent to ${nodeId}. ESP32 will download and flash automatically.`
          : `Firmware stored. MQTT not connected — OTA will be attempted on next ESP32 check-in.`,
      };
    },
  );

  // ── ESP32 downloads firmware ──────────────────────────
  app.get("/api/firmware/download/:nodeId", async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const fw = firmwareStore.get(nodeId);

    if (!fw) {
      return reply
        .code(404)
        .send({ error: "No firmware pending for this node" });
    }

    const entry = otaHistory.find(
      (e) => e.nodeId === nodeId && e.status === "pending",
    );
    if (entry) entry.status = "downloading";

    console.log(
      `[Firmware] ${nodeId} downloading ${fw.filename} (${(fw.size / 1024).toFixed(1)}KB)`,
    );

    reply.header("Content-Type", "application/octet-stream");
    reply.header(
      "Content-Disposition",
      `attachment; filename="${fw.filename}"`,
    );
    reply.header("Content-Length", fw.size);

    return fw.buffer;
  });

  // ── ESP32 reports OTA result ──────────────────────────
  app.post("/api/firmware/result", async (request) => {
    const { nodeId, success, error } = request.body as {
      nodeId: string;
      success: boolean;
      error?: string;
    };

    console.log(
      `[Firmware] OTA ${success ? "SUCCESS" : "FAILED"} for ${nodeId}${error ? `: ${error}` : ""}`,
    );

    const entry = otaHistory.find(
      (e) =>
        e.nodeId === nodeId &&
        (e.status === "pending" || e.status === "downloading"),
    );
    if (entry) {
      entry.status = success ? "success" : "failed";
      if (error) entry.error = error;
    }

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
