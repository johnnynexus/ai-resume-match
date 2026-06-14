import { defineConfig, devices } from "@playwright/test";

/**
 * One happy-path e2e flow (CLAUDE.md). Requires the full stack running:
 *   - API on :8080 with a valid ANTHROPIC_API_KEY  (pnpm --filter api dev)
 *   - Web on :3000                                  (pnpm --filter web dev)
 * Then: pnpm --filter web test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
