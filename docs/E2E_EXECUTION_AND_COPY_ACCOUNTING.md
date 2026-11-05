# End-to-end execution and copy accounting

**Scope:** `packages/capabilities` and the boundaries reachable from it in this
environment.
**Status vocabulary:** follows `docs/VALIDATION.md` (`[P] [C] [R] [M] [V]`).
**Artifact:** `packages/capabilities/bench/results/e2e-execution.json`, measured
on commit `bcdd250` with a clean worktree (`worktree_dirty: false`, sampled
before the runner wrote the artifact).
**Runner:** `packages/capabilities/bench/run-e2e-bench.mjs`.

This document records what was measured. Where a boundary in the target
architecture cannot be reached here, it is listed as `NOT RUN` with the blocker.
No figure below is estimated, and no mock result is presented as a provider
measurement.

## Environment

| Item | Value |
|---|---|
| Node | v26.13.0 |
| Platform | linux x64, 2 CPUs |
| Peak RSS during the run | 314.45 MB |
| Rust toolchain | **absent** (`cargo`/`rustc` not installed) |
| `@duckdb/duckdb-wasm`, `apache-arrow` | **not installed** (no pnpm binary, no lockfile importers) |
| LFM3 runtime or provider | **absent from the repository** |

## Gate 1 — real execution through the lifecycle

Executed capabilities: `sense.audio` (shipped handler, `mock` backend),
`code.resolve` (shipped composed-harness reference), and `native.sha256`
(real SHA-256 over real allocated bytes). `native.sha256` is a real provider
added by this benchmark, not a simulation of one: its output is checked against
an independent `createHash('sha256')` of the same buffer.

The `sense.audio` backend is the mock the repository ships. Its latency is path
overhead, not inference; no inference claim is made from it.

| Check | Result | Evidence |
|---|---|---|
| `sense.audio` end-to-end | pass | 8 events, cleanup `not_required` (contract declares no allocation) |
| `code.resolve` composed end-to-end | pass | `verified: true`, cleanup `not_required` |
| `native.sha256` output matches independent SHA-256 | pass | 262144 bytes, digest equal |
| Missing grant denies before invocation | pass | `AUTHORIZATION_DENIED`, provider invocations stayed at 1 |
| Invalid input rejected before allocation | pass | `INVALID_INPUT` |
| Unknown capability fails closed | pass | `UNKNOWN_CAPABILITY` |
| Trace correlation | pass | all events share `traceId`, `seq` contiguous, `eventId` unique |
| Event schema | pass | `exoskeleton.lifecycle.event/1.0` |
| Resource accounting | pass | allocations 1, releases 1, pool restored to 8 |

Workload: 256 KiB real SHA-256 per execution, 160 executions per level, 20
warm-up executions, grants `capability.compute`, resource = a rented buffer-pool
slot (64 KiB).

| Concurrency | Throughput | Request p50 | p95 | p99 | Max | Provider p50 | CPU ms |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2793.19/s | 0.3460 ms | 0.4117 ms | 0.8188 ms | 1.2604 ms | 0.3169 ms | 59.45 |
| 4 | 3429.33/s | 0.8877 ms | 1.3564 ms | 6.5663 ms | 6.5718 ms | 0.2001 ms | 50.59 |
| 16 | 2702.77/s | 5.1576 ms | 9.5820 ms | 9.5967 ms | 9.6041 ms | 0.3127 ms | 70.83 |
| 64 | 2906.24/s | 21.7478 ms | 22.0593 ms | 22.0770 ms | 22.0844 ms | 0.3146 ms | 70.71 |

**Finding:** throughput is flat at roughly 2.7k–3.4k executions/s while request
p50 grows linearly with concurrency. Provider p50 stays near 0.31 ms, so the
queueing is in the single-threaded JavaScript path, not in the provider. On this
2-CPU box the lifecycle adds no throughput beyond concurrency 4. That is a
measured property of this environment and implementation, not a scaling claim.

### Failure, timeout, cancellation and cleanup

| Scenario | Result |
|---|---|
| Cooperative cancellation (abort at 30 ms into 24 MiB) | `CANCELLED`; provider processed 10027008 / 25165824 bytes (39.8%), drain `settled`, released after stop |
| Timeout (40 ms) | `TIMEOUT`; provider processed 8978432 / 25165824 bytes (35.7%), drain `settled`, released after stop |
| Provider ignores abort | `TIMEOUT`; drain `pending`; released 268.80 ms *before* the ignored work settled |
| Provider throws | `HANDLER_ERROR`, allocations 1 / releases 1 |
| Caller-level retry (3 attempts) | final `ok`, generations distinct, allocations 3 / releases 3, pool restored |
| 32 concurrent with a 4-slot pool | 5 `AUTHORIZATION_DENIED`, 23 `ALLOCATION_FAILED`, 4 `OK`; allocations 4 / releases 4; pool restored; event sequences contiguous |

Cancellation now reaches the provider: the lifecycle aborts a
provider-facing signal on timeout or caller cancellation and releases only after
the work settles or a bounded drain elapses. A provider that ignores the signal
is reported as `workDrain: 'pending'` — the leftover is surfaced rather than
assumed stopped. The lifecycle itself still has no retry policy; retrying is
caller orchestration and was measured as such.

## Gate 2 — copy boundaries

Payload 8 MiB, 12 iterations for the in-process boundaries and 10 for the worker
boundaries. `bytes copied` is counted per call; `allocations` counts allocations
the test itself creates (allocator-level accounting is not observable without a
profiler, which is not installed).

| Boundary | Bytes copied/call | Allocations/call | p50 | p95 | p99 | How zero-copy was established |
|---|---:|---:|---:|---:|---:|---|
| `js.same_allocation_alias` | 0 | 1 | 0.1201 ms | 0.6548 ms | 0.6548 ms | Two views over one `ArrayBuffer`; each observed the other's write |
| `js.copy_baseline` | 8388608 | 2 | 9.3561 ms | 36.3744 ms | 36.3744 ms | `Buffer.from` copy; mutating the source did not change the copy |
| `worker.structured_clone` | 8388608 | 1 | 21.3433 ms | 35.8198 ms | 35.8198 ms | Sender not detached, worker's mutation invisible to the sender |
| `worker.transfer` | 0 | 1 | 6.3198 ms | 8.2485 ms | 8.2485 ms | Sender buffer `detached: true`, worker read the original bytes |
| `worker.shared_array_buffer` | 0 | 1 | 0.0566 ms | 0.2529 ms | 0.2529 ms | Two-way visibility: main wrote `0x11`, worker observed it, main observed the worker's `0x5a` |

The alias and copy rows are the baseline pair: the same payload moves 8 MiB of
copies in 9.3561 ms p50 versus 0.1201 ms p50 for a shared view. The worker rows
separate three distinct behaviours that are often conflated: `postMessage`
without a transfer list is a copy, a transfer list moves ownership (the sender's
buffer is detached), and `SharedArrayBuffer` is one allocation seen from both
threads. The `SharedArrayBuffer` result proves sharing, **not** thread safety:
no concurrent mutation protocol was tested.

### Boundaries not measured

| Boundary | Status | Blocker |
|---|---|---|
| Producer → Rust mailbox | `NOT RUN` | no `cargo`/`rustc`; `packages/substrate-native` has no built artifact and is not a dependency of any JS package |
| Native consumer → Node (N-API) / WASM | `NOT RUN` | `napi_bridge.rs` exists but `Cargo.toml` declares no napi dependency, so no loadable binding is produced |
| Arrow buffers → DuckDB | `NOT RUN` | `@duckdb/duckdb-wasm` and `apache-arrow` are not installed; `memory-chassis` imports them as types only |
| DuckDB persistence → recovery | `NOT RUN` | no DuckDB runtime installed, so there is no persistence path to measure |

Consequently **no zero-copy claim is made for the native or Arrow/DuckDB
boundaries.** The JS boundaries above are the only ones with evidence.

## Gate 3 — full pipeline: telemetry, overhead, restart recovery

Workload: 200 executions of 8 KiB SHA-256 at concurrency 4, identical across
sinks.

| Telemetry | Executions ok | Wall | Throughput | Request p50 | p95 | Events | Durable bytes |
|---|---:|---:|---:|---:|---:|---:|---:|
| Disabled (`NullEventSink`) | 200/200 | 11.6611 ms | 17151.06/s | 0.0976 ms | 0.1777 ms | 0 | 0 |
| In-memory (`MemoryEventSink`) | 200/200 | 5.4135 ms | 36944.40/s | 0.0806 ms | 0.1289 ms | 1600 | 0 |
| Durable (`JsonlEventSink`, fsync per execution) | 200/200 | 62.9418 ms | 3177.54/s | 0.2814 ms | 0.3932 ms | 1600 | 508299 |

**Finding:** the durable sink costs about 5.4x wall time and moves p50 from
0.0976 ms to 0.2814 ms, dominated by one `fsync` per execution. The in-memory
sink appearing *faster* than telemetry disabled is noise, not a speedup: at
0.08–0.15 ms per execution over 200 executions a single scheduling hiccup
dominates. Only the durable row separates from the baseline.

Restart recovery used two separate processes writing to the same file; the
verifier is a third process that reads only what was persisted:

| Stage | Events | Traces | Duplicates | Seq gaps | Malformed |
|---|---:|---:|---:|---:|---:|
| After process A (25 executions) | 200 | 25 | 0 | 0 | 0 |
| After process B appends 25 more | 400 | 50 | 0 | 0 | 0 |

Verifier exit status 0. Telemetry persistence and replay are established; a
persisted *execution state machine* does not exist, so its recovery is
`NOT RUN`.

## Gate 4 — reproducibility

```
npx tsc -p packages/capabilities
node --test packages/capabilities/test/lifecycle.test.mjs     # 17/17
node packages/capabilities/bench/run-e2e-bench.mjs
```

The artifact records commit SHA, clean-worktree state, Node version, platform,
CPU count, peak RSS, workload parameters, every raw per-scenario value, and the
`not_run` list. Deterministic inputs (payload bytes, iteration counts) are fixed
in the runner; latency figures move between runs and are reported as such.

## Acceptance summary

| Gate | Status | Basis |
|---|---|---|
| 1 — real execution | `MEASURED` for the capabilities that exist here | 8/8 gate checks; LFM3 provider `NOT RUN` |
| 2 — zero-copy boundaries | `PARTIAL` | JS boundaries measured (5/5 checks); Rust, N-API, Arrow/DuckDB `NOT RUN` |
| 3 — full pipeline | `PARTIAL` | 4/4 checks; telemetry persisted and recovered across processes; execution-state recovery `NOT RUN` |
| 4 — independent acceptance | `MEASURED` | artifact records commit, clean tree, toolchain, commands and raw values |

Total: **17/17 checks pass** on commit `bcdd250` with a clean worktree. Passing
these checks does not close the native gates; it establishes the JS-level
execution path and copy accounting that the native work must be compared against.
