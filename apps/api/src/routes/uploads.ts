import { Hono } from "hono";
import type { Env } from "../index";
import { authMiddleware } from "../middleware/auth";

const uploads = new Hono<{ Bindings: Env; Variables: Record<string, any> }>();

// POST /api/uploads/sign — Get a presigned R2 upload URL
uploads.post("/sign", authMiddleware, async (c) => {
  const internalUserId = c.get("internalUserId");
  const { fileName, contentType } = await c.req.json().catch(() => ({}));
  if (!fileName || !contentType) {
    return c.json({ error: "validation_failed", reason: "missing_fields" }, 400);
  }

  const key = `users/${internalUserId}/uploads/${Date.now()}-${encodeURIComponent(fileName)}`;
  
  // R2 direct upload via worker proxy
  const url = `/api/storage/upload/${encodeURIComponent(key)}?contentType=${encodeURIComponent(contentType)}`;
  
  return c.json({ key, uploadUrl: url, publicUrl: `/api/storage/${encodeURIComponent(key)}` });
});

// ── Beacon: POST /api/_beacon — Client-side failure telemetry ──
uploads.post("/_beacon", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return new Response(null, { status: 204 });
  
  console.log("[beacon]", JSON.stringify({
    route: body.route,
    fileSize: body.fileSize,
    durationMs: body.durationMs,
    effectiveType: body.effectiveType,
    errorName: body.errorName,
    errorMsg: String(body.errorMsg || "").slice(0, 200),
    userAgent: String(body.userAgent || "").slice(0, 200),
    sentAt: body.sentAt,
    timestamp: new Date().toISOString(),
  }));
  
  return new Response(null, { status: 204 });
});

// ── Debug: GET /debug/cors — Echo request CORS headers ──
uploads.get("/cors", async (c) => {
  const origin = c.req.header("Origin") || "none";
  const method = c.req.header("Access-Control-Request-Method") || c.req.method;
  const headers = c.req.header("Access-Control-Request-Headers") || "none";
  
  return c.json({
    requestHeaders: {
      origin,
      "access-control-request-method": method,
      "access-control-request-headers": headers,
      host: c.req.header("Host"),
      "user-agent": String(c.req.header("User-Agent") || "").slice(0, 100),
    },
    responseHeaders: {
      "access-control-allow-origin": "https://xuebaos.com",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
      "access-control-allow-headers": "authorization,content-type,x-web-version,x-request-id",
      "access-control-allow-credentials": "true",
    },
    serverTime: new Date().toISOString(),
  });
});

export default uploads;
