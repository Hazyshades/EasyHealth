import path from "node:path";
import type { NextConfig } from "next";

if (!process.env.CI && !process.env.SKIP_ENV_VALIDATION) {
  require("./src/lib/env");
}

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(__dirname) },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/landing/index.html" },
        { source: "/landing", destination: "/landing/index.html" },
        { source: "/landing/", destination: "/landing/index.html" },
        {
          source: "/landing/how-it-works",
          destination: "/landing/how-it-works/index.html",
        },
        {
          source: "/landing/how-it-works/",
          destination: "/landing/how-it-works/index.html",
        },
      ],
    };
  },
};

export default nextConfig;
