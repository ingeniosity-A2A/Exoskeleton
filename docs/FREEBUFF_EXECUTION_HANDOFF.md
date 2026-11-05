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

cargo fmt --manifest-path packages/substrate-native/Cargo.toml -- --check
cargo test --manifest-path packages/substrate-native/Cargo.toml --features turbovec
cargo bench --manifest-path packages/substrate-native/Cargo.toml --bench substrate --features turbovec
cargo bench --manifest-path packages/substrate-native/Cargo.toml --bench turbovec --features turbovec

python3 scripts/kinetic_suite.py --profile core
```

The runner executes Rust formatting, all package tests (including the TweenAtom invariants and optional TurboVec adapter), native mailbox/packed-arena and TurboVec microbenchmarks, and existing pnpm build/typecheck commands. If the Python DuckDB module is installed, it applies `schema_20.sql`, `schema_kinetic.sql`, and `schema_tween_atom.sql` in order. The explicit Cargo commands above are also required so FreeBuff can preserve each command's raw output independently.

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


---

# 6. Mandatory staged execution order — do not skip gates

The user-authorized order is:

**Gate 1 — prove kinetic retrieval against the exact local checkout and GitHub main.**  
**Gate 2 — only after Gate 1 passes, update the distilling implementation to use the proven kinetic path and run its tests.**  
**Gate 3 — only after Gate 2 passes, curate using the proven kinetics and perform the authorized refactoring.**

Do not combine these gates into one speculative rewrite. Do not begin distilling changes, model curation, or broad refactoring during Gate 1.

## Gate 1A — prove local checkout matches GitHub

Run inside the actual FreeBuff local Exoskeleton checkout. Replace the path placeholder with its real checkout path; do not guess it.

```bash
cd "<EXOSKELETON_LOCAL_PATH>"
set -euo pipefail

echo "=== ORIGIN ==="
ORIGIN_URL="$(git remote get-url origin)"
printf 'ORIGIN=%s\n' "$ORIGIN_URL"
case "$ORIGIN_URL" in
  https://github.com/ingeniosity-A2A/Exoskeleton.git|git@github.com:ingeniosity-A2A/Exoskeleton.git) ;;
  *) echo "STOP: origin is not the authoritative Exoskeleton repository"; exit 90 ;;
esac

echo "=== PRESERVE LOCAL WORK ==="
git status --short --branch
test -z "$(git status --porcelain)"

echo "=== FETCH AUTHORITATIVE MAIN ==="
git fetch --prune origin main
test "$(git branch --show-current)" = "main"

echo "=== RECORD PRE-SYNC IDENTITY ==="
LOCAL_BEFORE="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse origin/main)"
printf 'LOCAL_BEFORE=%s\nREMOTE_MAIN_SHA=%s\n' "$LOCAL_BEFORE" "$REMOTE_SHA"

if test "$LOCAL_BEFORE" != "$REMOTE_SHA"; then
  git merge-base --is-ancestor "$LOCAL_BEFORE" "$REMOTE_SHA" || {
    echo "STOP: local main is ahead of or diverged from origin/main; preserve and report both histories."
    exit 91
  }
  git pull --ff-only origin main
fi

echo "=== FINAL LOCAL/GITHUB IDENTITY ==="
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse origin/main)"
printf 'LOCAL_SHA=%s\nREMOTE_MAIN_SHA=%s\n' "$LOCAL_SHA" "$REMOTE_SHA"
test "$LOCAL_SHA" = "$REMOTE_SHA"

echo "=== CLEAN WORKTREE ==="
git status --short --branch
test -z "$(git status --porcelain)"

echo "=== REQUIRED SOURCE FILES ==="
test -f AGENTS.md
test -f docs/KINETIC_INTELLIGENCE_RETRIEVAL_ARCHITECTURE_AND_BENCHMARK_2026-11-05.md
test -f docs/TWEENATOM_STATE_CARRYING_CONTRACT.md
test -f docs/FREEBUFF_EXECUTION_HANDOFF.md
test -f scripts/kinetic_suite.py
test -f packages/substrate-native/src/turbovec_adapter.rs
test -f packages/substrate-native/benches/turbovec.rs
```

If origin, branch, SHA equality, or clean-worktree checks fail, stop and report the exact mismatch. Do not reset, force-push, overwrite local work, or silently discard uncommitted changes.

## Gate 1B — read contracts, then run all existing checks

```bash
set -euo pipefail
cat AGENTS.md
cat docs/SYSTEM_MEMORY_SOURCE_OF_TRUTH_AND_OPTIMIZATION_2026-11-05.md
cat docs/RUSTUNNEL_TRANSPORT_ARCHITECTURE_AUDIT_2026-11-05.md
cat docs/KINETIC_INTELLIGENCE_RETRIEVAL_ARCHITECTURE_AND_BENCHMARK_2026-11-05.md
cat docs/TWEENATOM_STATE_CARRYING_CONTRACT.md
cat docs/VALIDATION.md

rustc --version
cargo --version
python3 --version
python3 -m pip --version
uname -a
lscpu
free -h
df -h .

cargo fmt --manifest-path packages/substrate-native/Cargo.toml -- --check
cargo test --manifest-path packages/substrate-native/Cargo.toml --features turbovec
cargo bench --manifest-path packages/substrate-native/Cargo.toml --bench substrate --features turbovec
cargo bench --manifest-path packages/substrate-native/Cargo.toml --bench turbovec --features turbovec
python3 scripts/kinetic_suite.py --profile core
python3 scripts/kinetic_suite.py --profile full
```

Capture stdout and stderr separately for every command, preserve nonzero exit codes, and retain all generated files under `artifacts/kinetic/`. Do not mask a failure with `|| true`.

## Gate 1C — real kinetic retrieval proof, not just a microbenchmark

The existing TurboVec Rust benchmark uses deterministic generated vectors. It is a kernel/microbenchmark only; it does **not** prove semantic retrieval quality, corpus ingestion, evidence reconstruction, access-control correctness, or the full kinetic lifecycle.

FreeBuff must inspect the actual implementation and run the real end-to-end path if a pinned local corpus and ground-truth query set already exist:

1. source artifact → Lens/DocLang/Docling/TableFormer parsing, retaining page/region/table provenance;
2. canonical atomic records with stable IDs, content hashes, source revisions, temporal fields and access labels;
3. authorized durable DuckDB write and commit;
4. authorized query filtering before candidate retrieval;
5. full-precision baseline compared with each implemented TurboVec quantization arm and any actually implemented LEANN/keyword/SQL arm;
6. evidence reconstruction from canonical source records, not from vector payloads alone;
7. AVA-007 evaluation boundary, with REV.IKE strictly read-only;
8. replay/recovery and authorization-denial tests.

Use the same immutable corpus, query set, relevance judgments and ACL fixture across arms. Record corpus and query-set hashes, parser/index/model revisions, exact commands, Recall@1/5/10/20, MRR, nDCG, evidence coverage, table-cell accuracy where applicable, p50/p95/p99 latency, throughput, memory, allocations, copy/serialization counts, commit durability and recovery.

Hard gates: zero unauthorized/cross-tenant retrieval; zero Source Truth writes by models/REV.IKE/indexes; no execution without AVA-007 authorization; provenance reconstructable for every returned evidence item; durable writes survive the tested restart/replay procedure.

If no genuine corpus or ground-truth judgments are present, do not invent them and do not call the result a kinetic proof. You may run deterministic fixtures to validate plumbing, but label them **fixture/integration tests**, never retrieval-quality benchmarks. Report the missing corpus or judgments as a blocker and stop before Gate 2.

The runner's `available_not_executed`, `blocked`, and `not_run` statuses are not passes. Module importability and a passing TurboVec microbenchmark are not an end-to-end retrieval pass.

## Gate 1D — report and decision

Return:
- local HEAD and fetched `origin/main` SHA, exact equality result, branch and clean/dirty state;
- machine/runtime inventory and all command exit codes;
- raw test logs and benchmark output;
- full `artifacts/kinetic/<run-id>/report.json`;
- real corpus/query-set hashes and retrieval metrics, or an explicit blocker;
- each architecture stage marked specified / implemented / compiled / tested / benchmarked / blocked;
- a single Gate 1 decision: **PASS** or **BLOCKED/FAIL**, with evidence.

**Gate 1 passes only when** source identity is exact, all required existing code tests pass, the actual end-to-end retrieval lifecycle runs against a pinned real corpus and ground truth, and every hard gate above passes. Microbenchmarks alone never satisfy Gate 1.

## Gate 2 — distilling-to-kinetics code update (only after Gate 1 PASS)

Do not start before a recorded Gate 1 PASS. First locate the actual distilling implementation and its current tests. Read its owning AGENTS/source-of-truth contracts and identify its current input/output and promotion boundary. Propose the smallest compatible change so distilling consumes the proven kinetic evidence/metrics and preserves provenance, source revisions, authority boundaries and rollback. Implement only after this impact map is documented. Add regression tests for baseline behavior, kinetic input, failure/timeout, stale evidence, authorization and deterministic replay. Run the complete affected test suite plus Gate 1 regression suite. Report exact commit, diff, commands, outputs and Gate 2 PASS/FAIL. Do not curate models or refactor unrelated modules in this gate.

## Gate 3 — kinetic curation and refactoring (only after Gate 2 PASS)

Do not start before a recorded Gate 2 PASS. Use the proven kinetic metrics and provenance as curation evidence. Apply existing SPARC/AVA-007 promotion authority and gates; no model promotes itself. Preserve exact model/data revisions, license texts, checksums, quantization, evaluation results and rollback references. Refactor only code justified by measured evidence, with before/after tests and benchmarks. Preserve Manifesto wording, repository ownership, REV.IKE read-only status, and the AVA-007 acceptance/authorization boundary. Run all relevant regression, security, durability, recovery and performance tests after each coherent change. Report a final evidence matrix; do not mark deployment or acceptance without its separate proof.

## Execution prohibition

Until Gate 1 is PASS, **do not** edit distilling code, run model curation/promotion, merge model weights, change production routing, or perform broad refactoring. Until Gate 2 is PASS, **do not** begin Gate 3. No gate may be declared passed from documentation, generated fixture scores, source inspection alone, or upstream vendor benchmarks.
