import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(resolve("src/app/app/reports/create/page.tsx"), "utf8");
const dialog = readFileSync(resolve("src/components/ui/dialog.tsx"), "utf8");
for (const token of ["<Dialog open={modalOpen}", "<DialogContent>", "<DialogTitle>", "<DialogDescription>", "Select all", "Clear selection", "Additional settings", "Add selected"]) {
  if (!page.includes(token)) throw new Error(`[report-selector-dialog] missing ${token}`);
}
for (const token of ["DialogPrimitive.Portal", "DialogPrimitive.Overlay", "DialogPrimitive.Content"]) {
  if (!dialog.includes(token)) throw new Error(`[report-selector-dialog] shared primitive missing ${token}`);
}
console.log("[report-selector-dialog] portalled dialog preserves document selection controls");
