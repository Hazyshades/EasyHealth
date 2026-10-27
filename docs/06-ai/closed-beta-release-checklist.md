# Grounded assistant closed-beta release checklist

Scope: Sprint 8 assistant retrieval, evidence, safety, operations, and closed-beta release gates.

This checklist separates local implementation evidence from production launch evidence. A local green check is not a production go decision.

## Local implementation evidence

- [x] OpenSpec change validates with `openspec validate "sprint-8-grounded-ai-closed-beta" --type change --strict`.
- [x] EH-157 safety fixtures pass with `pnpm test:eh157`.
- [x] EH-155 structured retrieval fixtures pass with `pnpm test:eh155`.
- [x] EH-156 chunking fixtures pass with `pnpm test:eh156` and database contract with `pnpm test:eh156-db`.
- [x] EH-158 evidence fixtures pass with `pnpm test:eh158`.
- [x] EH-159 feedback contract passes with `pnpm test:eh159` and database contract with `pnpm test:eh159-db`.
- [x] EH-161 deletion contract passes with `pnpm test:eh161-db`.
- [ ] `pnpm typecheck` and `pnpm typecheck:worker` pass in the release environment.
- [ ] The running app is exercised with an invited beta profile and a safe fixture document.

## Production go/no-go record

Record one dated entry for each gate before enabling `closed_beta_enabled` for a real participant.

| Gate | Evidence required | Status | Owner/date |
| --- | --- | --- | --- |
| Safety | Diagnosis, medication, dose, urgency, unsupported-claim, and prompt-injection cases return safe limited responses | PENDING | |
| Source isolation | Two-profile retrieval test proves structured and semantic sources never cross profile ownership | PENDING | |
| Embedding provider | Production embedding key, model, dimension, timeout, retry, and spend alert are configured | PENDING | |
| Quota policy | Daily request and monthly cost ceilings are configured in production and tested under concurrency | PENDING | |
| Consent and invite | Current terms, health-data consent, AI consent, invite enablement, and revocation are verified | PENDING | |
| Deletion | Durable document deletion removes chunks and jobs, and export/deletion evidence is retained | PENDING | |
| Backup and restore | A production-like restore is executed; assistant tables, vectors, jobs, and policies are present after restore | PENDING | |
| Rollback | Previous app build and migration rollback/recovery procedure are rehearsed | PENDING | |
| Incident response | On-call owner, support channel, provider failure response, and unsafe-answer escalation are recorded | PENDING | |
| Monitoring | Request outcome, latency, token, retrieval, quota, and provider failure alerts are visible without prompt or document text | PENDING | |
| Beta sample | Synthetic example path is verified to write no profile, observation, document, or assessment rows | PENDING | |
| Go/no-go | All required gates are green or explicitly waived by the release owner | PENDING | |

## Known limitations

- Semantic retrieval requires the `vector` extension and a configured embedding provider.
- Assistant answers are educational and must not be used as diagnosis, prescription, dose, or emergency guidance.
- No source means no personal answer. The UI must show that limitation instead of filling the gap.
- Semantic index refresh is asynchronous. A document can be eligible before its narrative chunks are available.
- Production Wiki publication, incident contacts, backup/restore evidence, and provider spend alerts are operational gates, not inferred from local tests.

## Rollback and restore evidence template

- Release identifier:
- Migration range:
- Backup identifier:
- Restore environment:
- Restore started/finished:
- Tables and policies checked:
- Vector extension and index checked:
- Reindex queue replay checked:
- Durable deletion replay checked:
- Previous application build available:
- Result:
- Remaining risks:

## Incident handoff

- Support channel:
- On-call owner:
- Unsafe answer escalation owner:
- Provider outage owner:
- Data deletion incident owner:
- Maximum beta disable time:
- Evidence link:
