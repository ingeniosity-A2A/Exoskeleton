# Lifecycle and telemetry substrate

**Scope:** `packages/capabilities` only. Nothing outside this package changes.
**Status vocabulary:** follows `docs/VALIDATION.md` (`[P] [C] [R] [M] [V]`).

## What this adds

`CapabilityRegistry` answers "is this capability known, and can it be invoked".
It deliberately does not answer "was execution authorized, bounded, observed and
cleaned up". `CapabilityLifecycle` adds exactly that, around the existing
registry — it does not register capabilities itself, does not duplicate the
registry, and does not change any existing capability contract.

```
validate ──► resolve ──► allocate ──► execute ──► observe ──► validate_outcome ──► release ──► complete
   │            │            │            │
   └─ contract  └─ registry  └─ resources └─ timeout / cancellation
```

| Guarantee | Implementation |
|---|---|
| Input schema validated before execution | `contract.validateInput`, denial `INVALID_INPUT` |
| Capability-level grants checked | `contract.requiresGrants`, denial `AUTHORIZATION_DENIED` |
| Capability resolved through the registry | `CapabilityRegistry.resolve()` (read-only addition) |
| Bounded execution | `timeoutMs` (request → contract → default), denial `TIMEOUT` |
| Cooperative cancellation | `signal` checked pre-execution and raced in-flight, `CANCELLED` |
| Resource release on every path | `try/catch` around `allocation.release()`; runs on success, handler failure, timeout and cancellation |
| Cleanup failure surfaced, not hidden | `cleanup: 'failed'` + `release` event with `CLEANUP_ERROR`; primary outcome preserved |
| Telemetry cannot change execution | sink `emit()` is isolated in `try/catch` |
| Trace correlation | every event carries `traceId`, `generationId`, monotonic `seq` |

Grants are **capability-level scopes supplied by the caller**. They are not
Cybernetic-Ava007 policy and this module confers no governing authority.

## Event contract

`exoskeleton.lifecycle.event/1.0`

```
schema, eventId (traceId:seq), traceId, generationId, capability,
seq, phase, status, atMs, durationMs, errorCode, detail
```

Phases: `validate`, `resolve`, `allocate`, `execute`, `observe`,
`validate_outcome`, `interrupt`, `release`, `complete`.

Statuses: `start`, `ok`, `error`, `timeout`, `cancelled`.

Error codes: `INVALID_INPUT`, `CONTRACT_MISSING`, `AUTHORIZATION_DENIED`,
`UNKNOWN_CAPABILITY`, `ALLOCATION_FAILED`, `HANDLER_ERROR`, `TIMEOUT`,
`CANCELLED`, `INVALID_OUTPUT`, `CLEANUP_ERROR`.

Only an in-memory bounded sink (`MemoryEventSink`) is implemented. No external
exporter is claimed: none is provisioned.

## Reproduce

```
npm install --no-save --no-package-lock typescript@5.6.3   # workspace devDep only
npx tsc -p packages/capabilities
node --test packages/capabilities/test/lifecycle.test.mjs
node packages/capabilities/bench/run-lifecycle-bench.mjs
node packages/capabilities/bench/run-kinetics-bench.mjs
```

`pnpm-workspace.yaml` and `pnpm-lock.yaml` are untouched.

## Evidence

Both runners write raw JSON artifacts under `packages/capabilities/bench/results/`
including commit SHA, environment and exact command. Numbers below are from
`packages/capabilities/bench/results/kinetics-observer.json`, which records the
commit and the clean worktree it was measured on; latency figures move between
runs, accuracy figures are deterministic.

| Measurement | Result |
|---|---|
| Kinetics observer, executions through the lifecycle | 2400 (19200 events, 8 per execution) |
| Structural checks (release, telemetry order, denials, dedupe, stale generation) | 21/21 pass, exit 0 |
| Stationary convergence (10 deg, 600 frames at 1/60 s) | final error 0.000 deg, settles at frame 1 |
| Constant velocity 30 deg/s (600 frames) | final error -0.368508 deg, velocity error +0.019724 deg/s |
| Reversal at frame 300 | final error +0.368508 deg, worst transient 3.407509 deg at frame 308 |
| Frame jitter 0.5x-2x plus 6 intervals above 0.25 s | 594/600 applied, 6 rejected, final error -1.526582 deg |
| Gear ratio identified from plant output | 1.500000000000, gear B opposes gear A |
| Alignment period | 720 deg of gear A (1080 deg of gear B) |
| Discrete error eigenvalues | 0.9 at 1/60 s, 0.5 at 0.25 s (inside the unit circle) |
| Lifecycle cost per observer step | p50 0.009538-0.016331 ms, +0.013676 ms over unmediated registry.invoke |

Accuracy criteria (0.1 deg position, 0.1 deg/s velocity) are **not** all met. The
constant-velocity residual reproduces the previously recorded -0.36850756 deg and
scales with the frame interval (12.284 ms equivalent lag at 1/60 s, 8.333 ms at
1/120 s, 4.167 ms at 1/240 s). The runner reports this as a finding and does not
adjust the thresholds to clear it.

## Not run

| Plane | Status | Blocker |
|---|---|---|
| Observer correctness | `MEASURED (criteria not met)` | Deterministic plant and observer run through the lifecycle by `bench/run-kinetics-bench.mjs`. Accuracy thresholds from the experiment record are missed for constant velocity, reversal and frame jitter; see Evidence. |
| LFM3 inference | `NOT RUN` | No LFM3 provider or runtime is available here; no mock inference is substituted. |
| Memory plane (mailbox, Arrow, N-API, DuckDB) | `NOT RUN` | Not exercised by the lifecycle runner. No zero-copy claim is made. |
| Policy authorization | `NOT RUN` | Governing authority is Cybernetic-Ava007; this substrate only enforces capability-level grants. |
