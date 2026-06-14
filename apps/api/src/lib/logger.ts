import pino from "pino";

// Independent of config.ts so it's safe to use anywhere (including while
// reporting a config error). Pretty output in development; structured JSON
// elsewhere for log aggregation.
const isDev = (process.env.NODE_ENV ?? "development") === "development";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev
    ? { transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } } }
    : {}),
});
