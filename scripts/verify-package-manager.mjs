import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const expectedPackageManager = "pnpm@9.15.4";
const packagePath = resolve("package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const actualPackageManager = packageJson.packageManager;

if (actualPackageManager !== expectedPackageManager) {
  console.error(
    `[package-manager] expected ${expectedPackageManager}; found ${String(actualPackageManager)}`,
  );
  process.exit(1);
}

console.log(`[package-manager] declared package manager: ${actualPackageManager}`);
