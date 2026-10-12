import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { initHighlighter } from "./core/highlight.js";
import { loadFonts } from "./core/fonts.js";
import { setRenderer, renderRoutes } from "./routes/render.js";
import { startupSweep, startCleanupTimer, cleanupOnce, CLEANUP_INTERVAL_SECONDS } from "./core/cache.js";
import { PORT, HOST, API_KEY } from "./config.js";

async function main() {
  console.log("[startup] initializing highlighter…");
  const hl = await initHighlighter();
  const fonts = await loadFonts();
  const fontCount = Object.values(fonts).reduce((n, arr) => n + arr.length, 0);
  console.log(`[startup] fonts loaded: ${fontCount}`);

  await startupSweep();
  startCleanupTimer();

  const app = Fastify({ logger: false, trustProxy: true });

  app.setErrorHandler((err: any, _req, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) console.error(err);
    const code =
      status === 429 ? "rate_limited" : status === 404 ? "not_found" : status >= 500 ? "internal" : "bad_request";
    reply.code(status).send({
      error: { code, message: status >= 500 ? "internal server error" : status === 429 ? "too many requests" : err.message },
    });
  });

  await app.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX ?? "120", 10),
    timeWindow: "1 minute",
  });

  app.addHook("onRequest", async (req, reply) => {
    if (!API_KEY) return;
    if (req.url === "/health" || req.url.startsWith("/v1/themes") || req.url.startsWith("/v1/languages")) return;
    const provided = (req.headers["x-api-key"] as string) ?? (req.query as { api_key?: string })?.api_key;
    if (provided !== API_KEY) {
      return reply.code(401).send({ error: { code: "unauthorized", message: "invalid or missing API key" } });
    }
  });

  app.get("/health", async () => ({ status: "ok", uptime: process.uptime() }));

  setRenderer(hl, fonts);
  await app.register(renderRoutes);

  await app.listen({ port: PORT, host: HOST });
  console.log(`[ready] code-image-api listening on ${HOST}:${PORT}`);

  const shutdown = async () => {
    await cleanupOnce();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
