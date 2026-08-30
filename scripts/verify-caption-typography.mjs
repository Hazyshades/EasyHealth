import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const files = [
  "src/components/biomarker-table.tsx",
  "src/components/dashboard/widgets/medications-widget.tsx",
  "src/components/dashboard/widgets/water-balance-widget.tsx",
  "src/components/dashboard/widgets/weight-trend-widget.tsx",
  "src/components/ui/floating-filter-menu.tsx",
];
const css = readFileSync(resolve("src/app/globals.css"), "utf8");
if (!css.includes("--text-caption: 0.6875rem")) {
  throw new Error("Missing named --text-caption token");
}
for (const file of files) {
  const source = readFileSync(resolve(file), "utf8");
  if (!source.includes("text-caption") || /text-\[(10|11)px\]/.test(source)) {
    throw new Error(`Caption typography is not standardized in ${file}`);
  }
}
console.log("[caption-typography] named caption token replaces all targeted literals");
