import type { NextConfig } from "next";

const config: NextConfig = {
  // @resumematch/shared ships TypeScript source; let Next transpile it.
  transpilePackages: ["@resumematch/shared"],
};

export default config;
