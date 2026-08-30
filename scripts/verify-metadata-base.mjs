import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const layout = readFileSync(resolve("src/app/layout.tsx"), "utf8");
const expected = 'metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://easyhealth.app")';

if (!layout.includes(expected)) {
  console.error("[metadata-base] root metadata must use NEXT_PUBLIC_SITE_URL with the production fallback");
  process.exit(1);
}

console.log("[metadata-base] root metadata uses https://easyhealth.app instead of localhost by default");
