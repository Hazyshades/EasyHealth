import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("src/components/ui/status-chip.tsx"), "utf8");
const required = [
  'success: Check',
  'warning: AlertCircle',
  'error: AlertCircle',
  'info: Info',
  'aria-hidden="true"',
  'whitespace-nowrap',
  'shrink-0',
];

const missing = required.filter((token) => !source.includes(token));
if (missing.length) {
  console.error(`[status-chip] missing accessible status cues: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("[status-chip] status variants have decorative non-color cues and non-wrapping labels");
