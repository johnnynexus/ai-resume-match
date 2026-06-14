import { z } from "zod";

/**
 * Environment configuration, validated at the boundary with Zod (CLAUDE.md).
 * Parsed lazily and memoized so importing this module never crashes in contexts
 * that don't need a full runtime config (e.g. tooling).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-4-6"),
  DATABASE_URL: z.string().url().optional(),
  ALLOWED_ORIGIN: z.string().optional(),
});

export type Config = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  anthropicApiKey: string;
  model: string;
  databaseUrl: string | undefined;
  allowedOrigins: string[] | undefined;
  persistenceEnabled: boolean;
};

let cached: Config | null = null;

export function getConfig(): Config {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  const env = parsed.data;
  cached = {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    model: env.ANTHROPIC_MODEL,
    databaseUrl: env.DATABASE_URL,
    allowedOrigins: env.ALLOWED_ORIGIN
      ? env.ALLOWED_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
      : undefined,
    persistenceEnabled: Boolean(env.DATABASE_URL),
  };
  return cached;
}
