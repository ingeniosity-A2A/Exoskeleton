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

`date, commit_sha, OS, architecture, CPU, memory, compiler/runtime versions, optimization flags, workload, dataset shape, exact command, raw output, summary`

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


## Headless GitHub CLI Agent stack (branch `agent/kiri-autonomous-stack`)

Audit date: 2026-11-15. This stack is an **owner-directed override** of the read-only posture in `.agents/skills/github-dependency-steward/SKILL.md` (“Rev.Ike is read-only … it must not execute an update”, “Do not add … a new always-on Exoskeleton daemon”). The skill file and the Manifesto gates are unchanged by this branch; the override is recorded here rather than edited into doctrine. `AGENTS.md` still requires the evidence below.

Environment: Ubuntu 24.04.5 LTS, x86_64; Python 3.12.3 (venv `~/.venv-exo`); duckdb 2.0.0; PyYAML 6.0.3; `gh` 2.45.0 (unauthenticated in this environment); Docker CLI present but **no daemon**; `kiri` **not installed**; repository cloned from the branch at `ee1d6f8803ece417d35195aa19b61f1d852a5561`.

```
[M] 2026-11-15 | ee1d6f8 | byte-compile of the shipped agent and health server
Environment: Ubuntu 24.04.5 LTS x86_64, Python 3.12.3, duckdb 2.0.0
Command: python -m py_compile Dependencies/gh_headless_agent.py Dependencies/health_server.py
Result: no output, exit 0

[M] 2026-11-15 | ee1d6f8 | loop script syntax
Command: bash -n Dependencies/agent_loop.sh
Result: no output, exit 0

[M] 2026-11-15 | ee1d6f8 | register + status + render against a fresh DuckDB file
Command: SCHEMA_PATH=Memory/schemas/dependency_index.sql DUCKDB_PATH=/tmp/gh-exo.db python Dependencies/gh_headless_agent.py register kiri 0.1.0 https://github.com/libracoder/kiri --comm websocket --cli --docs --host s26_ultra_termux ; … status ; … render
Result: status => dependencies 1, green_band 1, orange_band 0, lead_bots 0; render => 788 bytes

[M] 2026-11-15 | ee1d6f8 | HTTP surface of health_server.py
Command: AGENT_HEALTH_PORT=9091 python Dependencies/health_server.py & curl -s localhost:9091/{health,status,audit}
Result: /health 200 {"status":"healthy","state":"healthy"}; /status reports the live counts above; /audit returns the chained 'registered' event

[M] 2026-11-15 | ee1d6f8 | fail-closed behavior without GitHub credentials
Command: GH_TOKEN unset; python Dependencies/gh_headless_agent.py run
Result: exit code 1; log "GitHub authentication unavailable; skipping verification" detail "You are not logged into any GitHub hosts"; results.errors 1; INDEX.md still rendered

[M] 2026-11-15 | ee1d6f8 | compose interpolation
Command: env -u GH_TOKEN docker compose config -q ; GH_TOKEN=dummy docker compose config
Result: without token, interpolation error "required variable GH_TOKEN is missing a value"; with token, config resolves and shows the agent/dashboard services, the 9090 healthcheck, `depends_on: condition: service_healthy` and both `dev.kiri.domain` labels
```

**[C] present but NOT measured here:** image build, `kiri compose up`, container healthcheck transitions, dashboard nginx serving, and any live `verify_from_gh` cycle (needs an authenticated `gh`; no token exists in this environment, so version verification against GitHub is unproven). `INDEX.md` on this branch is the empty bootstrap render (0 dependencies), not a populated index.

**Known open gaps in this branch (source-level, not yet fixed):**

- `dependencies` has `UNIQUE(name)`, so one dependency cannot hold separate per-host rows; host routing lives only in `host_interfaces`.
- `verify_from_gh` records `epistemic_state = 'OBSERVED'` and falls back to `default_branch` as the version when a repository has no release, so “OBSERVED version” can hold a branch name.
- `_audit` derives `event_id` from `MAX(event_id) + 1`; concurrent writers can collide.
- The schema comment says “BLAKE3 hash” while `content_hash()` computes BLAKE2b-256.
- `dependencies` and `dependency_versions` share one sequence, so their ids interleave.
