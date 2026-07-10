// apps/frontend/serve.ts
import { serve } from "bun";
import { join } from "path";
import { readFileSync, existsSync, statSync } from "fs";

const DIST = join(import.meta.dirname, "dist");
const PORT = parseInt(process.env.PORT || "3000");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

serve({
  port: PORT,
  fetch(req: Request) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    if (pathname === "/") pathname = "/index.html";

    const filePath = join(DIST, pathname);

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const ext = pathname.substring(pathname.lastIndexOf("."));
      const isHash = /-[a-f0-9]{8,}\./.test(pathname);

      return new Response(readFileSync(filePath), {
        headers: {
          "Content-Type": MIME[ext] || "application/octet-stream",
          "Cache-Control": isHash
            ? "public, max-age=31536000, immutable"
            : "public, max-age=0, must-revalidate",
        },
      });
    }

    // SPA fallback
    return new Response(readFileSync(join(DIST, "index.html")), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  },
});

console.log(`Server running on port ${PORT}`);
