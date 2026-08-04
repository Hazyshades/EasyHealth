/**
 * EH-116: safe Registry 2.0 observation reprocessing batches.
 *
 * Service-role CLI. There is no HTTP admin surface. The CLI writes only to
 * `registry_reprocess_batches`, `registry_reprocess_batch_rows`, and — on
 * `--apply` — through the existing EH-106 atomic writer. No second writer
 * family, no direct observation or revision write.
 *
 * Usage examples:
 *   pnpm reprocess:batch -- --document 00000000-0000-0000-0000-000000000117 \
 *     --batch-limit 100 --dry-run --actor-id <uuid>
 *
 *   pnpm reprocess:batch -- --batch <batchId> --apply --actor-id <uuid>
 *
 *   EH116_CONFIRM_GLOBAL=yes pnpm reprocess:batch -- --global \
 *     --batch-limit 500 --max-documents 20 --dry-run --actor-id <uuid>
 *
 *   pnpm reprocess:batch -- --document <uuid> --dry-run \
 *     --include-manual-decisions --reason "corrected specimen catalog" \
 *     --actor-id <uuid>
 */
import {
  DEFAULT_RESOLVER_RESULT_FILTER,
  applyReprocessBatch,
  runReprocessBatchDryRun,
  type ReprocessBatchInputs,
  type ReprocessBatchScope,
  type ReprocessResolverResultFilter,
} from "../src/lib/registry-reprocessing";
import type { ResolverResult } from "../src/lib/biomarkers";

type ParsedArgs = {
  documentId: string | null;
  profileId: string | null;
  global: boolean;
  dryRun: boolean;
  apply: boolean;
  batchId: string | null;
  batchLimit: number | null;
  maxDocuments: number | null;
  resolverResults: ReprocessResolverResultFilter;
  includeManualDecisions: boolean;
  reason: string | null;
  actorId: string | null;
  actorNote: string | null;
};

function parseArgs(argv: readonly string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    documentId: null,
    profileId: null,
    global: false,
    dryRun: false,
    apply: false,
    batchId: null,
    batchLimit: null,
    maxDocuments: null,
    resolverResults: DEFAULT_RESOLVER_RESULT_FILTER,
    includeManualDecisions: false,
    reason: null,
    actorId: process.env.EH116_ACTOR_ID ?? null,
    actorNote: process.env.EH116_ACTOR_NOTE ?? null,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value == null || value.startsWith("--")) {
        throw new Error(`Flag ${token} requires a value`);
      }
      i += 1;
      return value;
    };

    switch (token) {
      case "--document":
        parsed.documentId = next();
        break;
      case "--profile":
        parsed.profileId = next();
        break;
      case "--global":
        parsed.global = true;
        break;
      case "--dry-run":
        parsed.dryRun = true;
        break;
      case "--apply":
        parsed.apply = true;
        break;
      case "--batch":
        parsed.batchId = next();
        break;
      case "--batch-limit": {
        const raw = next();
        const value = Number.parseInt(raw, 10);
        if (!Number.isInteger(value) || value <= 0) {
          throw new Error(`--batch-limit must be a positive integer, got "${raw}"`);
        }
        parsed.batchLimit = value;
        break;
      }
      case "--max-documents": {
        const raw = next();
        const value = Number.parseInt(raw, 10);
        if (!Number.isInteger(value) || value <= 0) {
          throw new Error(`--max-documents must be a positive integer, got "${raw}"`);
        }
        parsed.maxDocuments = value;
        break;
      }
      case "--resolver-result": {
        const raw = next();
        const wanted: ResolverResult[] = raw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
          .map((s) => {
            if (
              s !== "resolved" &&
              s !== "partial" &&
              s !== "ambiguous" &&
              s !== "unmapped"
            ) {
              throw new Error(`Unknown resolver_result "${s}"`);
            }
            return s;
          });
        if (wanted.length === 0) {
          throw new Error("--resolver-result must list at least one outcome");
        }
        parsed.resolverResults = wanted;
        break;
      }
      case "--include-manual-decisions":
        parsed.includeManualDecisions = true;
        break;
      case "--reason":
        parsed.reason = next();
        break;
      case "--actor-id":
        parsed.actorId = next();
        break;
      case "--actor-note":
        parsed.actorNote = next();
        break;
      case "--help":
      case "-h":
        printUsageAndExit(0);
        break;
      default:
        throw new Error(`Unknown flag "${token}"`);
    }
  }

  return parsed;
}

function printUsageAndExit(code: number): never {
  const usage = `EH-116 reprocess-batch CLI

  --document <uuid>            Reprocess one document (primary selector)
  --profile <uuid>             Reprocess one profile (primary selector)
  --global                     Reprocess every profile (primary selector; needs EH116_CONFIRM_GLOBAL=yes)

  --dry-run                    Compute and record a diff, do not write
  --apply                      Apply an existing batch's pending rows (requires --batch <uuid>)
  --batch <uuid>               Existing batch id (required with --apply)

  --batch-limit <N>            Hard row limit (required)
  --max-documents <N>          Optional distinct-document cap (recommended for --global)
  --resolver-result <list>     Comma list of resolved,partial,ambiguous,unmapped (default: all four)

  --include-manual-decisions   Include user_verified/manually_corrected active revisions
  --reason "<text>"            Required with --include-manual-decisions

  --actor-id <uuid>            Service actor id (default EH116_ACTOR_ID env)
  --actor-note "<text>"        Free-text audit note (also EH116_ACTOR_NOTE env)

Environment:
  EH116_CONFIRM_GLOBAL=yes     Required to run --global without an interactive prompt
`;
  process.stdout.write(usage);
  process.exit(code);
}

function chooseScope(parsed: ParsedArgs): ReprocessBatchScope {
  const chosen = [parsed.documentId, parsed.profileId, parsed.global].filter(Boolean).length;
  if (chosen !== 1) {
    throw new Error(
      "exactly one of --document, --profile, or --global is required"
    );
  }
  if (parsed.documentId) {
    return { kind: "document", documentId: parsed.documentId };
  }
  if (parsed.profileId) {
    return { kind: "profile", profileId: parsed.profileId };
  }
  return { kind: "global" };
}

function guardGlobalScope(scope: ReprocessBatchScope): void {
  if (scope.kind !== "global") return;
  const confirm = process.env.EH116_CONFIRM_GLOBAL;
  if (confirm === "yes") return;
  if (process.stdin.isTTY) {
    // Interactive prompt is intentionally simple: any run without the env
    // variable in a non-TTY environment is a hard reject to prevent
    // accidental use from CI.
    throw new Error(
      "--global requires EH116_CONFIRM_GLOBAL=yes (or run with an interactive TTY and the env var set)"
    );
  }
  throw new Error(
    "--global requires EH116_CONFIRM_GLOBAL=yes when run without a TTY"
  );
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.dryRun === parsed.apply) {
    throw new Error("exactly one of --dry-run or --apply is required");
  }

  if (parsed.includeManualDecisions && (!parsed.reason || parsed.reason.trim().length === 0)) {
    throw new Error("--include-manual-decisions requires --reason \"<non-empty>\"");
  }

  if (!parsed.actorId || parsed.actorId.length === 0) {
    throw new Error("--actor-id is required (or set EH116_ACTOR_ID)");
  }

  if (parsed.apply) {
    if (!parsed.batchId) {
      throw new Error("--apply requires --batch <uuid>");
    }
    const summary = await applyReprocessBatch({
      batchId: parsed.batchId,
      actorId: parsed.actorId,
    });
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: "apply",
          batchId: summary.batch.id,
          state: summary.batch.state,
          release: summary.batch.release,
          counters: summary.batch.counters,
          rowCount: summary.rowCount,
          abortReason: summary.batch.abortReason,
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const scope = chooseScope(parsed);
  guardGlobalScope(scope);

  if (!parsed.batchLimit) {
    throw new Error("--batch-limit is required for --dry-run");
  }

  const inputs: ReprocessBatchInputs = {
    scope,
    filters: {
      resolverResults: parsed.resolverResults,
      includeManualDecisions: parsed.includeManualDecisions,
      manualDecisionReason: parsed.reason,
    },
    batchLimit: parsed.batchLimit,
    maxDocuments: parsed.maxDocuments,
    actorId: parsed.actorId,
    actorNote: parsed.actorNote,
  };

  const outcome = await runReprocessBatchDryRun(inputs);

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: "dry_run",
        batchId: outcome.batch.id,
        scope: outcome.batch.scope,
        filters: outcome.batch.filters,
        release: outcome.batch.release,
        state: outcome.batch.state,
        candidateCount: outcome.candidateCount,
        counters: outcome.batch.counters,
      },
      null,
      2
    )}\n`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
