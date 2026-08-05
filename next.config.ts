import path from "node:path";
import type { NextConfig } from "next";

if (!process.env.CI && !process.env.SKIP_ENV_VALIDATION) {
  require("./src/lib/env");
}

const nextConfig: NextConfig = {
  // Pin the workspace root: an unrelated lockfile in a parent directory
  // otherwise makes Turbopack resolve modules outside this project.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
