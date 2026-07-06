import { z } from "zod";

const DEFAULT_MODELS = {
  gemini: "gemini-2.5-flash",
  claude: "claude-sonnet-4-6",
} as const;

/**
 * Environment configuration, validated at the boundary with Zod (CLAUDE.md).
 * Parsed lazily and memoized so importing this module never crashes in contexts
 * that don't need a full runtime config (e.g. tooling).
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(8080),
    LLM_PROVIDER: z.enum(["gemini", "claude"]).default("gemini"),
    LLM_MODEL: z.string().min(1).optional(),
    /** @deprecated Use LLM_MODEL instead. Kept for existing Claude deployments. */
    ANTHROPIC_MODEL: z.string().min(1).optional(),
    GEMINI_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    DATABASE_URL: z.string().url().optional(),
    ALLOWED_ORIGIN: z.string().optional(),
    INTERNAL_API_SECRET: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.LLM_PROVIDER === "gemini" && !env.GEMINI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GEMINI_API_KEY is required when LLM_PROVIDER=gemini",
        path: ["GEMINI_API_KEY"],
      });
    }
    if (env.LLM_PROVIDER === "claude" && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ANTHROPIC_API_KEY is required when LLM_PROVIDER=claude",
        path: ["ANTHROPIC_API_KEY"],
      });
    }
  });

export type LlmProviderName = "gemini" | "claude";

export type Config = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  llmProvider: LlmProviderName;
  model: string;
  geminiApiKey: string | undefined;
  anthropicApiKey: string | undefined;
  databaseUrl: string | undefined;
  allowedOrigins: string[] | undefined;
  persistenceEnabled: boolean;
  internalApiSecret: string | undefined;
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
  const defaultModel = DEFAULT_MODELS[env.LLM_PROVIDER];
  const model =
    env.LLM_MODEL ??
    (env.LLM_PROVIDER === "claude" ? env.ANTHROPIC_MODEL : undefined) ??
    defaultModel;

  cached = {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    llmProvider: env.LLM_PROVIDER,
    model,
    geminiApiKey: env.GEMINI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    databaseUrl: env.DATABASE_URL,
    allowedOrigins: env.ALLOWED_ORIGIN
      ? env.ALLOWED_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
      : undefined,
    persistenceEnabled: Boolean(env.DATABASE_URL),
    internalApiSecret: env.INTERNAL_API_SECRET,
  };
  return cached;
}
