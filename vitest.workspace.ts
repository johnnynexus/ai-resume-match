import { defineWorkspace } from "vitest/config";

// Run unit tests across the workspace. Playwright e2e lives in apps/web and is
// run separately via `pnpm test:e2e`, so it is intentionally not included here.
export default defineWorkspace([
  "packages/shared",
  "apps/api",
]);
