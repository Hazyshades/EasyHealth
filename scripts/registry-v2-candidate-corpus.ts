import {
  candidateCorpusSummary,
  canonicalJson,
  runRegistryV2CandidateCorpus,
} from "./lib/registry-v2-candidate-corpus";

type Mode = "--check" | "--report" | "--manifest" | "--input-hash";

function usage(): never {
  console.error("Usage: tsx scripts/registry-v2-candidate-corpus.ts --check|--report|--manifest|--input-hash [--root <path>]");
  process.exit(1);
}

const args = process.argv.slice(2);
const mode = args.find((argument): argument is Mode => ["--check", "--report", "--manifest", "--input-hash"].includes(argument));
if (!mode || args.filter((argument) => ["--check", "--report", "--manifest", "--input-hash"].includes(argument)).length !== 1) usage();
const rootIndex = args.indexOf("--root");
if (rootIndex !== -1 && (!args[rootIndex + 1] || rootIndex + 2 !== args.length)) usage();
if (rootIndex === -1 && args.length !== 1) usage();

try {
  const run = runRegistryV2CandidateCorpus({ root: rootIndex === -1 ? undefined : args[rootIndex + 1] });
  if (mode === "--input-hash") {
    console.log(run.manifest.candidateInputHash);
  } else if (mode === "--manifest") {
    process.stdout.write(canonicalJson(run.manifest));
  } else if (mode === "--report") {
    process.stdout.write(canonicalJson(run));
  } else {
    process.stdout.write(canonicalJson(candidateCorpusSummary(run)));
    if (!run.manifest.launchable) process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
