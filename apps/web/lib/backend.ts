/** Server-only helpers for proxying authenticated requests to the Fastify API. */

const API_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function getApiBaseUrl(): string {
  return API_BASE;
}

export function internalAuthHeaders(userId: string): HeadersInit {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    throw new Error("INTERNAL_API_SECRET is not configured");
  }
  return {
    "x-internal-auth": secret,
    "x-user-id": userId,
  };
}
