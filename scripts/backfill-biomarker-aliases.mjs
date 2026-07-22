#!/usr/bin/env node

throw new Error(
  "scripts/backfill-biomarker-aliases.mjs was retired by EH-105. " +
    "The legacy observation identity column was removed in Registry 2.0; do not retarget alias rewrites " +
    "to semantic Registry 2.0 fields. EH-106 owns any mapping migration."
);
