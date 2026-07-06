import type { FastifyRequest } from "fastify";
import { getConfig } from "../lib/config.js";
import { AppError } from "../lib/errors.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string | null;
  }
}

function readUserId(request: FastifyRequest): string | null {
  const raw = request.headers["x-user-id"];
  if (typeof raw === "string" && raw.length > 0) return raw;
  return null;
}

/**
 * `onRequest` hook enforcing the internal BFF auth for /api/analyze.
 *
 * Wire this onto the ROOT instance in index.ts (app.addHook), NOT via
 * app.register(): a hook added inside an encapsulated plugin only runs for
 * routes in that plugin's own subtree, so registering it as a sibling of the
 * route plugins would silently skip it and leave request.userId undefined.
 *
 * When INTERNAL_API_SECRET is set, /api/analyze requires trusted BFF headers
 * (x-internal-auth + x-user-id). Without a secret, the route stays open for
 * local dev and analyze:sample.
 */
export async function authOnRequest(request: FastifyRequest): Promise<void> {
  request.userId = null;

  if (!request.url.startsWith("/api/analyze")) return;

  const secret = getConfig().internalApiSecret;
  if (!secret) return;

  const provided = request.headers["x-internal-auth"];
  if (provided !== secret) {
    throw new AppError("UNAUTHORIZED", "Invalid credentials.", 401);
  }

  const userId = readUserId(request);
  if (!userId) {
    throw new AppError("UNAUTHORIZED", "User identity is required.", 401);
  }
  request.userId = userId;
}
