# FreeBuff execution handoff — Kinetic Intelligence Retrieval

**Repository:** https://github.com/ingeniosity-A2A/Exoskeleton  
**Required branch:** `main`  
**Purpose:** Execute the reproducible tests and benchmarks that are already wired into this repository, identify missing integrations, and return raw artifacts. Do not claim full architecture acceptance from a partial run.

## 1. Required source reading

Read in order:
1. `AGENTS.md`
2. `docs/SYSTEM_MEMORY_SOURCE_OF_TRUTH_AND_OPTIMIZATION_2026-11-05.md`
3. `docs/RUSTUNNEL_TRANSPORT_ARCHITECTURE_AUDIT_2026-11-05.md`
4. `docs/KINETIC_INTELLIGENCE_RETRIEVAL_ARCHITECTURE_AND_BENCHMARK_2026-11-05.md`
5. `docs/TWEENATOM_STATE_CARRYING_CONTRACT.md`
6. `docs/VALIDATION.md`

Do not alter Manifesto canon. Do not use QAG_MemBrain or the retired A2A Exoskeleton architecture. Do not promote REV.IKE to authority. Do not introduce Arrow as mandatory. Do not report synthetic data as a real corpus benchmark.

## 2. Execute core tests and substrate benchmarks

Run from a clean clone:

```bash
git clone https://github.com/ingeniosity-A2A/Exoskeleton.git
cd Exoskeleton
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
python3 scripts/kinetic_suite.py --profile core
```

The runner executes Rust formatting, Rust library tests (including the TweenAtom invariants and optional TurboVec adapter), native mailbox/packed-arena and TurboVec microbenchmarks, and existing pnpm build/typecheck commands. If the Python DuckDB module is installed, it applies `schema_20.sql`, `schema_kinetic.sql`, and `schema_tween_atom.sql` in order.

## 3. Execute full integration preflight

```bash
python3 scripts/kinetic_suite.py --profile full
```

Exit code meanings:
- `0`: no failed or blocked steps in the selected profile (does not imply every research integration was run).
- `1`: one or more executable tests failed.
- `2`: one or more required full-profile integrations are blocked or unavailable.

The report is written under `artifacts/kinetic/<UTC-run-id>/report.json`; exact executed commands are in `commands.txt`.

## 4. Environment and workload requirements for the complete kinetic test

Before running document/retrieval/transport arms, prepare and record:
- A pinned Hugging Face model/dataset manifest: repository ID, immutable revision, file list, checksums, license and source metadata. Do not put tokens in logs or artifacts.
- A local immutable corpus path; set `KINETIC_CORPUS=/absolute/path/to/corpus`.
- Installed and version-pinned Docling/TableFormer and TurboVec adapters. Module presence alone is not a passing integration test.
- A fixed query set and relevance/evidence judgments, plus a full-precision retrieval ground truth.
- A Rustunnel endpoint used only for a narrow test service; set `KINETIC_RUSTUNNEL_URL` only after it is live and authenticated. Never expose DuckDB, shell, admin, or device-control endpoints.
- Tailscale and 5G edge tests with actual path classification and device/modem telemetry. Label emulator/synthetic runs separately.
- A real trained DFM model for the DFM arm. The current Rust `dfm_parametric.rs` module is a promotion metadata seam, not the paper's trained model.
- A specified holographic binding/bundling algorithm. Do not call a generic vector index holographic memory.

No model download, remote tunnel operation, device command, or credential use is performed implicitly by the test runner.

## 5. Required return package

Return:
1. Exact `git rev-parse HEAD`.
2. OS, CPU architecture/model, RAM, Rust/Cargo, Node/pnpm, Python and DuckDB versions.
3. Full `report.json`, stdout/stderr, and all raw benchmark output.
4. Test failures with exact file/line and minimal reproduction.
5. Missing dependencies/adapters and why each blocks an arm.
6. For each completed benchmark: corpus hash, query-set hash, model/parser/index versions, command, repeated-run distributions, p50/p95/p99, throughput, memory, allocations/copies, retrieval metrics and provenance/ACL checks.
7. Explicitly separate **Specified**, **Implemented**, **Compiled**, **Tested**, **Benchmarked**, **Deployed**, and **Accepted**.

Do not change application source or dependency versions during this first execution pass. File defects as evidence-backed findings and report them before making implementation changes. No PR or GitHub Actions workflow is required; changes remain direct-to-main only after explicit review.
