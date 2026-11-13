# Exoskeleton Validation Dock

**Rule:** a claim is not measured merely because it appears in source, documentation or a test name. Record exact dated evidence.

## Status vocabulary

- `[P]` proposed design.
- `[C]` source code present.
- `[R]` reported or claimed, not independently measured.
- `[M]` measured with reproducible command and output.
- `[V]` acceptance criterion independently verified.

## Framework boundary checks

| Boundary | Required validation | Status |
|---|---|---|
| Cybernetic-Ava007 → Exoskeleton | Authorized intent contract; no transfer of intelligence authority | [R] |
| Exoskeleton → Omni-OS | Capability contract, identity, environment allocation and lifecycle | [R] |
| Rev.Ike within Exoskeleton | Intake, provenance, grants, curation and fail-closed behavior | [R] |
| MA Computing A2A ownership | No A2A protocol ownership or misplaced A2A docs in this repository | [C] documentation alignment |

## Runtime and data-plane checks

| Check | Example evidence | Status |
|---|---|---|
| Workspace install | exact pnpm + Node versions; frozen install output | [R] |
| TypeScript build/typecheck | exact workspace command and output | [R] |
| Rust native tests | `cargo test` output and toolchain version | [R] |
| Rust memory safety | soundness review + concurrency tests/Miri or equivalent | [R] |
| Mailbox publish/read | generation, contention, lifetime and overwrite tests | [R] |
| N-API/WASM bridge | actual build artifact and runtime invocation | [R] |
| Arrow/DuckDB ingest | schema, runtime, input/output and copy accounting | [R] |
| Quack recovery | process interruption, replay, idempotency and reconciliation | [R] |
| Rev.Ike intake | source, normalization, provenance and grant tests | [R] |
| Capability lifecycle | authorization, provider selection, timeout, cancellation, release | [R] |
| Android device inference | exact device/build, runtime/provider versions, target-side execution proof and fallback | [P] |
| Observability | schema, propagation, redaction and exporter-failure tests | [R] |

## Zero-copy benchmark requirements

A zero-copy result must name the exact boundary and data representation. Benchmark at least:

- producer → mailbox;
- mailbox → native consumer;
- native → Node/N-API or WASM;
- Arrow → DuckDB;
- persistence/recovery.

Record bytes copied, allocations, throughput, p50/p95/p99 latency, peak memory, CPU utilization, concurrency and workload shape. Include a copy-based baseline. A single zero-copy boundary does not make the whole pipeline zero-copy.

## Benchmark environment record

Every measured entry must include:

`date, commit_sha, OS, architecture, CPU, memory, compiler/runtime versions, optimization flags, workload, dataset shape, exact command, raw output, summary`.

## Evidence log

No measured results are currently asserted by this document. Append entries in this format only after running the command:

```
[M] YYYY-MM-DD | <commit SHA> | <check>
Environment: <OS/arch/CPU/runtime/compiler>
Command: <exact command>
Result: <concise output and artifact link>
```

Promote to `[V]` only when the explicit acceptance criteria and independent verification are complete.


## Kinetic suite runner

The reproducible runner is present at `scripts/kinetic_suite.py`; the native microbenchmark is `packages/substrate-native/benches/substrate.rs`. The FreeBuff handoff is `docs/FREEBUFF_EXECUTION_HANDOFF.md`.

These are **[C] implemented test orchestration and native microbenchmark code**. No execution output is recorded here. The full Docling/TableFormer, TurboVec, holographic, trained DFM, Rustunnel, Hugging Face corpus, and physical 5G arms remain blocked until their concrete adapters, pinned corpus/model, endpoints, and device evidence are supplied. Do not promote these to [M] or [V] until the runner artifacts exist and acceptance criteria pass.


## TweenAtom contract and implementation

- Contract: `docs/TWEENATOM_STATE_CARRYING_CONTRACT.md`.
- Rust type: `packages/substrate-native/src/tween_atom.rs`.
- DuckDB schema: `packages/memory-chassis/src/schema_tween_atom.sql`.
- Rust unit tests are included in `cargo test --lib --features turbovec`.
- Schema application is included in the kinetic runner after `schema_20.sql` and `schema_kinetic.sql`.

Status: **[C] source and schema committed; not yet compiled, migrated, integration-tested, or benchmarked.** Receipt references are not cryptographic verification. AVA-007 remains the sole authority; the runtime must verify the receipt before committing accepted/authorized state.


## Dependency stewardship snapshot

Audit date: 2026-11-13. Exoskeleton `main` was inspected at `fdffc34bbe99e3f36fba6be9143f70afcd083ac2`. The local workspace was at `815ffc1d388cb77520dc06ebec37572681ab94ee`, with existing uncommitted work preserved on backup branch `backup/local-progress-815ffc1-2026-11-13` (latest backup commit `3f78763096e12489e68dd2bed88c12aab84f0591`). `gh` 2.103.3 was authenticated. The eight declared dependency source repositories in `docs/DEPENDENCY_LEDGER.md` were verified through `gh repo view`; this confirms the repository URLs resolve, not license compliance, latest versions, compatibility, or update status. The local skill was discovered with `gh skill list --scope project --json skillName,path,scope,sourceURL,version`.

Finding: current upstream `package.json` specifies pnpm 9.15.0 while `pnpm-lock.yaml` records 12.10.0 and omits workspace dependency importers. `Cargo.toml` declares optional TurboVec 1.1.2 without a `Cargo.lock` in the inspected tree. These mismatches block automatic dependency updates until reconciled and baseline validation exists. No dependency or skill update was installed or tested.

Reproduce the read-only checks with:

```sh
gh api repos/ingeniosity-A2A/Exoskeleton/commits/main --jq '.sha'
gh api repos/ingeniosity-A2A/Exoskeleton/git/commits/fdffc34bbe99e3f36fba6be9143f70afcd083ac2 --jq '.tree.sha'
gh repo view microsoft/TypeScript --json nameWithOwner,url,isArchived,licenseInfo
```


## Tailscale policy steward contract

Audit date: 2026-11-13. The local tailscale-policy-steward skill was added to require a Grant review on every exit-node/policy task and official bundled tailscale/hujson parsing, formatting, standardization, validation, and structured diffs. `gh repo view` verified the official https://github.com/tailscale/hujson and https://github.com/tailscale/tailscale-skill source repositories. This verifies source URL resolution only; no library was pinned or embedded, no skill was installed, no live tailnet policy was retrieved or changed, and no Grant was applied. Current policy and intended client/exit-node scope are still required before any policy mutation.

Tailscale's current policy documentation says custom policies need access to autogroup:internet for exit-node use; a Grant without via can expose every configured exit node. Treat a Grant check/update as mandatory, but do not create a duplicate or broad rule if existing Grants already permit the intended use. See https://tailscale.com/docs/features/exit-nodes and https://tailscale.com/docs/features/access-control/grants/grants-explained.
