import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const projects = [
  { name: "application", path: "tsconfig.json", compiler: "node_modules/typescript/bin/tsc", cwd: "." },
  { name: "document worker", path: "tsconfig.json", compiler: "worker/node_modules/typescript/bin/tsc", cwd: "worker" },
] as const;



for (const project of projects) {
  const configPath = resolve(project.cwd, project.path);

  if (!existsSync(configPath)) {
    console.error(`[typescript-projects] ${project.name}: missing ${project.path}`);
    process.exit(1);
  }

  console.log(`[typescript-projects] checking ${project.name} (${configPath})`);

  const result = spawnSync(process.execPath, [resolve(project.compiler), "--project", project.path, "--noEmit"], { cwd: resolve(project.cwd), stdio: "inherit" });

  if (result.error) {
    console.error(`[typescript-projects] ${project.name}: could not start TypeScript`, result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[typescript-projects] ${project.name}: TypeScript check failed`);
    process.exit(result.status ?? 1);
  }
}

console.log("[typescript-projects] application and document worker passed");
