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

const landingRoots = process.env.LANDING_ROOT
  ? [resolve(process.env.LANDING_ROOT)]
  : [resolve("public/landing"), resolve("landing-site")];
const files = [
  "index.html",
  "how-it-works/index.html",
];
let compiledPageCount = 0;

for (const landingRoot of landingRoots) {
  for (const relativePath of files) {
    const filePath = resolve(landingRoot, relativePath);
    const source = await readFile(filePath, "utf8");
    const compiled = source.replaceAll(defaultSiteOrigin, configuredSiteOrigin);
    await writeFile(filePath, compiled);
    compiledPageCount += 1;
  }
}

console.log(
  `Compiled landing metadata for ${configuredSiteOrigin} (${compiledPageCount} pages across ${landingRoots.length} mirrors).`,
);
