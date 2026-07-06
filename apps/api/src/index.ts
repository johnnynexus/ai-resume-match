import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { getConfig } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { AppError, toErrorResponse } from "./lib/errors.js";
import { analyzeRoutes } from "./routes/analyze.js";
import { resumeRoutes } from "./routes/resume.js";
import { authOnRequest } from "./plugins/auth.js";

async function buildServer() {
  const cfg = getConfig();

  const app = Fastify({ loggerInstance: logger });

  // CORS: explicit allow-list in production; permissive in development.
  await app.register(cors, {
    origin: cfg.allowedOrigins ?? (cfg.nodeEnv === "production" ? false : true),
  });

  // Resume PDFs — cap upload size to keep memory bounded.
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  app.get("/health", async () => ({ status: "ok" }));

  // Register auth on the ROOT instance so the hook runs for the route plugins
  // below. If this were wrapped in app.register(), Fastify encapsulation would
  // scope the hook to its own (route-less) subtree and it would never fire for
  // /api/analyze — silently leaving request.userId undefined (no persistence).
  app.decorateRequest("userId", null);
  app.addHook("onRequest", authOnRequest);
  await app.register(analyzeRoutes);
  await app.register(resumeRoutes);

  // Central error handling: structured envelope, no stack traces to clients.
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send(toErrorResponse(error.code, error.message));
      return;
    }
    // Fastify / plugin client errors (validation, file-too-large, etc.)
    const e = error as Error & { statusCode?: number; code?: string };
    if (typeof e.statusCode === "number" && e.statusCode >= 400 && e.statusCode < 500) {
      reply.status(e.statusCode).send(toErrorResponse(e.code ?? "BAD_REQUEST", e.message));
      return;
    }
    request.log.error({ err: error, reqId: request.id }, "unhandled error");
    reply.status(500).send(toErrorResponse("INTERNAL_ERROR", "Something went wrong."));
  });

  return { app, cfg };
}

async function main() {
  const { app, cfg } = await buildServer();
  try {
    await app.listen({ port: cfg.port, host: "0.0.0.0" });
    logger.info(
      { persistence: cfg.persistenceEnabled, model: cfg.model },
      `API listening on :${cfg.port}`,
    );
    if (!cfg.internalApiSecret) {
      logger.warn(
        "INTERNAL_API_SECRET is unset — /api/analyze runs unauthenticated and " +
          "analyses will NOT be attributed to a user or persisted to history. " +
          "Set it here and in the web app (must match) to enable persistence.",
      );
    }
  } catch (err) {
    logger.error({ err }, "failed to start server");
    process.exit(1);
  }
}

void main();
