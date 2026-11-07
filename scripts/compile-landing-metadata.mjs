import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const defaultSiteOrigin = "https://easyhealth.app";
const configuredSiteOrigin = (
  process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteOrigin
).trim().replace(/\/+$/, "");

let parsedOrigin;
try {
  parsedOrigin = new URL(configuredSiteOrigin);
} catch {
  throw new Error(
    `NEXT_PUBLIC_SITE_URL must be an absolute URL, received ${configuredSiteOrigin}`,
  );
}

if (!/^https?:$/.test(parsedOrigin.protocol)) {
  throw new Error(
    `NEXT_PUBLIC_SITE_URL must use http or https, received ${configuredSiteOrigin}`,
  );
}

const landingRoot = resolve(
  process.env.LANDING_ROOT ?? "public/landing",
);
const files = [
  "index.html",
  "how-it-works/index.html",
];

for (const relativePath of files) {
  const filePath = resolve(landingRoot, relativePath);
  const source = await readFile(filePath, "utf8");
  const compiled = source.replaceAll(defaultSiteOrigin, configuredSiteOrigin);
  await writeFile(filePath, compiled);
}

console.log(
  `Compiled landing metadata for ${configuredSiteOrigin} (${files.length} pages).`,
);
