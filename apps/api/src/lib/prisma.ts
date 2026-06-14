import { PrismaClient } from "@prisma/client";
import { getConfig } from "./config.js";

// Lazily instantiated. Returns null when DATABASE_URL is unset, so the API can
// run the Claude core without a database during early development.
let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient | null {
  if (!getConfig().persistenceEnabled) return null;
  if (!client) client = new PrismaClient();
  return client;
}
