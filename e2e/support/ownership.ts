import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { assertRunId } from "./env";

export const E2E_STATE_DIR = join(process.cwd(), ".playwright");
export const RUN_CONTEXT_PATH = join(E2E_STATE_DIR, "e2e-run.json");
export const PRIMARY_STORAGE_STATE = join(E2E_STATE_DIR, "e2e-primary-storage-state.json");
export const SAFETY_STORAGE_STATE = join(E2E_STATE_DIR, "e2e-safety-storage-state.json");

export type E2EPrincipal = {
  authUserId: string;
  profileId: string;
  email: string;
  storageStatePath: string;
};

export type OwnedDocument = {
  id: string;
  profileId: string;
  fixture: string;
  storagePaths: string[];
};

export type E2ERunContext = {
  runId: string;
  createdAt: string;
  baseURL: string;
  storagePrefix: string;
  principals: Partial<Record<"primary" | "safety", E2EPrincipal>>;
  documents: Record<string, OwnedDocument>;
  storagePaths: string[];
};

export function createRunContext(runId: string, baseURL: string): E2ERunContext {
  assertRunId(runId);
  return {
    runId,
    createdAt: new Date().toISOString(),
    baseURL,
    storagePrefix: `e2e/${runId}/`,
    principals: {},
    documents: {},
    storagePaths: [],
  };
}

export function readRunContext(): E2ERunContext {
  if (!existsSync(RUN_CONTEXT_PATH)) {
    throw new Error("No E2E ownership ledger exists. Refusing cleanup without an owned run context.");
  }
  const context = JSON.parse(readFileSync(RUN_CONTEXT_PATH, "utf8")) as E2ERunContext;
  assertContext(context);
  return context;
}

export function writeRunContext(context: E2ERunContext): void {
  assertContext(context);
  mkdirSync(dirname(RUN_CONTEXT_PATH), { recursive: true });
  writeFileSync(RUN_CONTEXT_PATH, `${JSON.stringify(context, null, 2)}\n`, "utf8");
}

export function registerPrincipal(context: E2ERunContext, key: "primary" | "safety", principal: E2EPrincipal): void {
  if (context.principals[key]) throw new Error(`The ${key} E2E principal is already registered.`);
  context.principals[key] = principal;
  writeRunContext(context);
}

export function registerDocument(context: E2ERunContext, document: OwnedDocument): void {
  if (!document.id || document.profileId !== context.principals.primary?.profileId && document.profileId !== context.principals.safety?.profileId) {
    throw new Error("Refusing to register a document outside the E2E-owned profiles.");
  }
  if (context.documents[document.fixture]) throw new Error(`Fixture ${document.fixture} is already registered.`);
  for (const path of document.storagePaths) assertOwnedStoragePath(context, path);
  context.documents[document.fixture] = document;
  for (const path of document.storagePaths) addStoragePath(context, path);
  writeRunContext(context);
}

export function registerStoragePath(context: E2ERunContext, storagePath: string): void {
  assertOwnedStoragePath(context, storagePath);
  addStoragePath(context, storagePath);
  writeRunContext(context);
}

export function assertOwnedStoragePath(context: E2ERunContext, storagePath: string): void {
  if (!storagePath.startsWith(context.storagePrefix) || storagePath === context.storagePrefix) {
    throw new Error("Refusing an unowned or unscoped Storage path.");
  }
}

export function removeRunArtifacts(): void {
  for (const file of [RUN_CONTEXT_PATH, PRIMARY_STORAGE_STATE, SAFETY_STORAGE_STATE]) {
    if (existsSync(file)) rmSync(file, { force: true });
  }
}

function assertContext(context: E2ERunContext): void {
  if (!context || typeof context !== "object") throw new Error("Invalid E2E ownership ledger.");
  assertRunId(context.runId);
  if (context.storagePrefix !== `e2e/${context.runId}/`) throw new Error("Invalid E2E storage namespace.");
  if (!Array.isArray(context.storagePaths) || !context.documents || !context.principals) {
    throw new Error("Invalid E2E ownership ledger shape.");
  }
  for (const path of context.storagePaths) assertOwnedStoragePath(context, path);
}

function addStoragePath(context: E2ERunContext, storagePath: string): void {
  if (!context.storagePaths.includes(storagePath)) context.storagePaths.push(storagePath);
}
