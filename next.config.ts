import type { NextConfig } from "next";

if (!process.env.CI && !process.env.SKIP_ENV_VALIDATION) {
  require("./src/lib/env");
}

const nextConfig: NextConfig = {};

export default nextConfig;
