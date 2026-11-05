# End-to-end execution and copy accounting

**Scope:** `packages/capabilities` and the boundaries reachable from it in this
environment.
**Status vocabulary:** follows `docs/VALIDATION.md` (`[P] [C] [R] [M] [V]`).
**Artifact:** `packages/capabilities/bench/results/e2e-execution.json`, measured
on commit `0028d77` with a clean worktree (`worktree_dirty: false`, sampled
before the runner wrote the artifact), after rebasing this branch onto the then
current `main` (`0ba30aa`).
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
| Peak RSS during the run | 288.63 MB |
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
| 1 | 2725.74/s | 0.3480 ms | 0.4421 ms | 0.7648 ms | 1.5319 ms | 0.3188 ms | 63.72 |
| 4 | 4426.21/s | 0.8392 ms | 0.9517 ms | 0.9846 ms | 0.9907 ms | 0.1892 ms | 41.79 |
| 16 | 4690.36/s | 3.2210 ms | 3.4383 ms | 4.5285 ms | 4.5343 ms | 0.1851 ms | 44.40 |
| 64 | 2825.32/s | 18.8314 ms | 22.5512 ms | 22.5613 ms | 22.5625 ms | 0.3144 ms | 72.94 |

**Finding:** throughput stays inside a 2.7k–4.7k executions/s band with no gain
past concurrency 16, while request p50 grows from 0.3480 ms to 18.8314 ms.
Provider p50 stays between 0.1851 ms and 0.3188 ms throughout, so the queueing
is in the single-threaded JavaScript path, not in the provider. On this 2-CPU
box the lifecycle does not scale throughput with concurrency; that is a measured
property of this environment and implementation, not a scaling claim.

### Failure, timeout, cancellation and cleanup

| Scenario | Result |
|---|---|
| Cooperative cancellation (abort at 30 ms into 24 MiB) | `CANCELLED`; provider processed 7405568 / 25165824 bytes (29.4%), drain `settled`, released after stop |
| Timeout (40 ms) | `TIMEOUT`; provider processed 10027008 / 25165824 bytes (39.8%), drain `settled`, released after stop |
| Provider ignores abort | `TIMEOUT`; drain `pending`; released 269.56 ms *before* the ignored work settled |
| Provider throws | `HANDLER_ERROR`, allocations 1 / releases 1 |
| Caller-level retry (3 attempts) | final `ok`, generations distinct, allocations 3 / releases 3, pool restored |
| 32 concurrent with a 4-slot pool | 5 `AUTHORIZATION_DENIED`, 23 `ALLOCATION_FAILED`, 4 `OK`; allocations 4 / releases 4; pool restored; event sequences contiguous |

Cancellation reaches the provider: the lifecycle aborts a provider-facing signal
on timeout or caller cancellation and releases only after the work settles or a
bounded drain elapses. A provider that ignores the signal is reported as
`workDrain: 'pending'` — the leftover is surfaced rather than assumed stopped.
The lifecycle itself has no retry policy; retrying is caller orchestration and
was measured as such.

## Gate 2 — copy boundaries

Payload 8 MiB, 12 iterations for the in-process boundaries and 10 for the worker
boundaries. `bytes copied` is counted per call; `allocations` counts allocations
the test itself creates (allocator-level accounting is not observable without a
profiler, which is not installed).

| Boundary | Bytes copied/call | Allocations/call | p50 | p95 | p99 | How zero-copy was established |
|---|---:|---:|---:|---:|---:|---|
| `js.same_allocation_alias` | 0 | 1 | 0.2706 ms | 0.8967 ms | 0.8967 ms | Two views over one `ArrayBuffer`; each observed the other's write |
| `js.copy_baseline` | 8388608 | 2 | 7.6075 ms | 19.1609 ms | 19.1609 ms | `Buffer.from` copy; mutating the source did not change the copy |
| `worker.structured_clone` | 8388608 | 1 | 21.0822 ms | 34.1310 ms | 34.1310 ms | Sender not detached, worker's mutation invisible to the sender |
| `worker.transfer` | 0 | 1 | 5.5376 ms | 10.5557 ms | 10.5557 ms | Sender buffer `detached: true`, worker read the original bytes |
| `worker.shared_array_buffer` | 0 | 1 | 0.0935 ms | 0.4096 ms | 0.4096 ms | Two-way visibility: main wrote `0x11`, worker observed it, main observed the worker's `0x5a` |

The alias and copy rows are the baseline pair: the same payload costs 7.6075 ms
p50 to copy versus 0.2706 ms p50 for a shared view. The worker rows separate
three behaviours that are often conflated: `postMessage` without a transfer list
is a copy, a transfer list moves ownership (the sender's buffer is detached),
and `SharedArrayBuffer` is one allocation seen from both threads. The
`SharedArrayBuffer` result proves sharing, **not** thread safety: no concurrent
mutation protocol was tested.

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
| Disabled (`NullEventSink`) | 200/200 | 17.7984 ms | 11236.99/s | 0.1697 ms | 0.3257 ms | 0 | 0 |
| In-memory (`MemoryEventSink`) | 200/200 | 21.5697 ms | 9272.26/s | 0.1463 ms | 0.2270 ms | 1600 | 0 |
| Durable (`JsonlEventSink`, fsync per execution) | 200/200 | 66.8484 ms | 2991.84/s | 0.4735 ms | 0.6558 ms | 1600 | 507751 |

**Finding:** the durable sink costs roughly 3.1–3.8x wall time and moves p50
from 0.17 ms to 0.4735 ms, dominated by one `fsync` per execution. The disabled
and in-memory rows do not separate from each other: this run had in-memory
slower in wall time but faster in p50, while the previous run inverted both.
At this workload size (0.15–0.17 ms per execution over 200 executions) that
comparison is noise, not a speedup, so no overhead claim is made for the
in-memory sink in either direction.

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
in the runner; latency figures move between runs and are reported as such. This
artifact was generated on the branch rebased onto `0ba30aa`, with no uncommitted
changes at measurement time.

## Acceptance summary

| Gate | Status | Basis |
|---|---|---|
| 1 — real execution | `MEASURED` for the capabilities that exist here | 8/8 gate checks; LFM3 provider `NOT RUN` |
| 2 — zero-copy boundaries | `PARTIAL` | JS boundaries measured (5/5 checks); Rust, N-API, Arrow/DuckDB `NOT RUN` |
| 3 — full pipeline | `PARTIAL` | 4/4 checks; telemetry persisted and recovered across processes; execution-state recovery `NOT RUN` |
| 4 — independent acceptance | `MEASURED` | artifact records commit, clean tree, toolchain, commands and raw values |

Total: **17/17 checks pass** on commit `0028d77` with a clean worktree. Passing
these checks does not close the native gates; it establishes the JS-level
execution path and copy accounting that the native work must be compared against.
