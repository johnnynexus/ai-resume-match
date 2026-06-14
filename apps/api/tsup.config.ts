import { defineConfig } from "tsup";

// Bundle the workspace `@resumematch/shared` package (it ships TypeScript
// source, not a built artifact) while leaving real npm dependencies external —
// they're installed in the production image's node_modules.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  clean: true,
  sourcemap: true,
  noExternal: ["@resumematch/shared"],
});
