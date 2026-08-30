import { rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve();
const generatedDirectories = [".next", "out"];

for (const directory of generatedDirectories) {
  const target = resolve(root, directory);

  if (!target.startsWith(`${root}${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error(`Refusing to remove path outside repository root: ${target}`);
  }

  rmSync(target, { force: true, recursive: true });
  console.log(`[clean] removed ${directory}`);
}
