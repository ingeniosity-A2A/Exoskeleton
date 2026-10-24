# Cross-repository benchmark contract

This directory owns the shared evidence format and gate, not each domain's benchmark implementation.

| Domain | Implementation owner | Required measurement families |
|---|---|---|
| Code / native index | Code-owning repository; Criterion stays beside its Cargo crate | correctness, throughput, latency distribution, allocation/memory where measurable |
| UI / browser | Ava007-Omni-OS | build/typecheck, browser smoke, interaction latency, functional/visual regression |
| Cognitive memory / retrieval | Cybernetic-Ava007; external memory authority stays separate | precision/recall, groundedness, provenance, retrieval latency, token/storage cost |
| Edge / Android | MA-Edge-Computing | cold/warm start, p50/p95 latency, memory/CPU, battery/thermal when measurable, device/runtime metadata |
| Orchestration / lifecycle | A2A-Exoskeleton (successor must be explicitly selected before porting) | dependency ordering, cancellation, retries, synchronization, lifecycle correctness, end-to-end latency |
| Shared schema and regression policy | Exoskeleton | evidence validation and consistent pass/fail semantics |

Do not move benchmark code into a repository that does not own the runtime. Do not duplicate UI, Android, Rust, or retrieval frameworks to force one runner.

Each benchmark emits JSON conforming to [result.schema.json](result.schema.json). Record commit, environment, timestamp, status, metrics and correctness checks; include exact command, dataset/version, provider/model, device and artifact paths when relevant. Never store secrets, private prompts or customer records in artifacts.

Statuses are `PASS`, `FAIL`, `BLOCKED`, and `NOT_RUN`. The gate fails for non-PASS correctness checks and configured regressions. Set `lowerIsBetter: false` for recall or throughput. Use per-metric `maxRegressionPercent` where possible. Baselines must come from recorded runs; the gate does not invent them.

Commands:
- `pnpm test` — unit tests for the evidence gate.
- `pnpm benchmark:validate path/to/result.json` — validate result structure.
- `pnpm benchmark:gate path/to/result.json` — require overall and check statuses to pass.
- `pnpm benchmark:gate path/to/result.json --max-regression-percent=10` — default regression budget for metrics with baselines and no per-metric limit.

No GitHub Actions workflow is added. Run checks on an approved operator host and retain output and artifacts. Static files are not execution evidence.
