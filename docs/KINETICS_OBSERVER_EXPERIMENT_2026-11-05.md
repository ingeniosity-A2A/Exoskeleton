# Kinetics Observer — Chat Session and Evidence Record

**Record date:** 2026-11-05  
**Repository:** `ingeniosity-A2A/Exoskeleton`  
**Branch at inspection:** `main`  
**Purpose:** Preserve the Kinetics Observer discussion, observed test evidence, and the governing architecture decision. This is a session record, not an implementation claim.

## 1. Governing architecture decision

The user explicitly corrected the testing approach:

> The framework uses Exoskeleton; the experiment must run through Exoskeleton, not through a standalone harness.

This is the controlling decision for subsequent work.

- **Cybernetic-Ava007 / AVA-007:** governing intelligence, purpose, reasoning authority, and authorized intent.
- **Exoskeleton:** structural interface, capability execution/orchestration, lifecycle, telemetry, and validation.
- **Kinetics Observer:** the experiment/component to be executed and measured through Exoskeleton.
- **LFM3:** local model inference capability, to be invoked through the framework's existing supported model interface.
- **Omni-OS:** device and operating environment.

Do not create a parallel Python execution framework or treat a direct HTTP call to llama.cpp as an Exoskeleton execution. Do not alter an existing bridge, invent a new WebSocket service, or introduce another runtime before inspecting the actual current interfaces.

The next implementation step is source inspection of the active Exoskeleton repository to identify the existing capability registration, execution lifecycle, telemetry/event contract, and model-provider integration. Reuse those interfaces; do not duplicate them.

## 2. Repository inspection

The canonical repository was verified through GitHub:

- Repository: `https://github.com/ingeniosity-A2A/Exoskeleton`
- Default branch: `main`
- Visibility: public
- Authenticated permissions: admin, maintain, push, pull
- Branch head at inspection: `473e44e81f2801b28a4a8503334b498822438007`

Observed repository structure includes:

- `docs/VALIDATION.md`
- `docs/AI_OBSERVABILITY.md`
- `docs/CAPABILITY_LAYER.md`
- `docs/MEMORY_SYSTEM_SOURCE_TRUTH_2026-11-05.md`
- `docs/LAYER_0_MEMORY_PLANE.md`
- `docs/VECTOR_CORE.md`
- `engine/rev_ike.py`
- `packages/capabilities/`
- `packages/librarian/`
- `packages/memory-chassis/`
- `packages/substrate-native/`

The repository README identifies Exoskeleton as the structural interface and points to Cybernetic-Ava007 as the authority for AVA-007's canonical definition. Existing memory-system documentation is already present; this session does not replace it or introduce QAG_MemBrain as an active system.

The prior discussion also referenced a local workspace at `~/Ava007/packages/amos` and historical package names such as `gsap_temporal`, `shared_memory`, and `speculative_engine`. Their current status and relationship to this canonical repository were **not established in this session**. They must be inspected before being treated as active Exoskeleton interfaces.

## 3. Local Kinetics project evidence

The user reported working in:

`~/artifacts/kinetics-observer`

Files identified in the project discussion:

- `index.html`
- `script.js`
- `style.css`
- `worker_test.py`

The contents of `script.js` and `worker_test.py` were pasted into the chat. The complete local project directory was not accessible through the GitHub connector; therefore this record does **not** claim that those local files or any unprovided assets were uploaded.

### 3.1 Deterministic gear implementation

Values observed in `script.js`:

| Parameter | Value |
|---|---:|
| `TEETH_A` | 24 |
| `TEETH_B` | 16 |
| `RATIO` | 1.5 |
| `RA` | 48 |
| `RB` | 32 |
| `D` | 80 |
| `PHI0` | 0° |
| `L1` | 12 |
| `L2` | 36 |
| Maximum observer substep | 0.01 s |
| Maximum accepted raw frame interval | 0.25 s |

The deterministic plant law is:

```text
phi = PHI0 - theta * RATIO
phi = -1.5 * theta
```

The common marked-tooth alignment period is:

```text
360 * TEETH_B / gcd(TEETH_A, TEETH_B) = 720 degrees of Gear A
```

Gear B rotates in the opposite direction and turns 1080 degrees in magnitude during that 720-degree Gear A cycle.

Pointer interaction on Gear A adds the measured angular delta to `theta`. Pointer interaction on Gear B subtracts `delta / RATIO` from `theta`. The left/right controls change `theta` by five degrees. Reset clears the observer initialization and state.

### 3.2 Observer recurrence

The observed JavaScript update is a two-state position/velocity observer:

```text
error = measuredTheta - aiEstTheta
aiEstTheta += (aiEstOmega + L1 * error) * dt
aiEstOmega += L2 * error * dt
```

The first measurement initializes estimated position to the measurement. Subsequent updates use `performance.now()`, subdivide accepted frame intervals into steps no larger than 0.01 seconds, and skip intervals whose raw delta is nonpositive or greater than 0.25 seconds.

The continuous-time characteristic polynomial associated with the stated gains is:

```text
s^2 + 12s + 36 = (s + 6)^2
```

Continuous-time stability alone does not establish the discrete implementation's tracking accuracy or stability under actual event timing. Those require reproducible runtime tests.

## 4. Reported local environment and LFM3 evidence

The user supplied the following terminal output:

| Check | Observed result |
|---|---|
| `GET http://127.0.0.1:8080/health` | `{"status":"ok"}` |
| Model file | `~/LFM3-Omni-2B-Q4_K_M.gguf`, approximately 1.1 GB |
| Python | 3.14.8 |
| llama.cpp server | 0.8.0, Android aarch64 |

The `/v1/models` response identified the loaded GGUF and reported:

- Model file: `LFM3-Omni-2B-Q4_K_M.gguf`
- Parameter count: 1,728,801,600
- Quantization: Q4_K - Medium
- Context reported by the server: 1024
- Input modality: text
- Output modality: text
- Runtime owner: `llamacpp`

A real `/v1/chat/completions` request asked for the exact response `LFM3_INFERENCE_OK`. The server returned that exact response.

Reported timing for that request:

| Measurement | Result |
|---|---:|
| Prompt processing | 1232.456 ms |
| Prompt processing rate | 17.039 tokens/s |
| Generation | 205.246 ms |
| Generation rate | 38.978 tokens/s |
| Completion tokens | 9 |

**Evidence boundary:** this proves the tested local text-completion path returned generated output. It does not prove Exoskeleton integration, multimodal capability, observer correctness, hardware telemetry ingestion, or end-to-end experiment performance.

## 5. Deterministic baseline result

The user ran a numerical check for the 24:16 gear relationship at angles 0, 5, 90, 180, 360, 540, 720, and -360 degrees.

Observed output:

```text
theta=   0.00  phi=    0.00  ratio=1.5000
theta=   5.00  phi=   -7.50  ratio=1.5000
theta=  90.00  phi= -135.00  ratio=1.5000
theta= 180.00  phi= -270.00  ratio=1.5000
theta= 360.00  phi= -540.00  ratio=1.5000
theta= 540.00  phi= -810.00  ratio=1.5000
theta= 720.00  phi=-1080.00  ratio=1.5000
theta=-360.00  phi=  540.00  ratio=1.5000
ratio=1.5000; cycle=720 degrees
PASS: deterministic gear law and cycle
```

**Result:** the stated deterministic relationship and cycle calculation passed this numerical check. This is a mathematical baseline, not an Exoskeleton benchmark.

## 6. Observer diagnostic result

A separate controlled Python calculation replicated the observer recurrence with:

- `L1 = 12`
- `L2 = 36`
- frame interval = 1/60 second
- 600 frames
- constant plant velocity = 30 degrees/second
- initial measured position = 10 degrees
- observer position initialized from the first measurement
- substeps no larger than 0.01 seconds

Observed output:

```text
final position error: -0.36850756 degrees
final velocity error: 0.01972387 degrees/sec
maximum position error after initialization: 1.51950093
FAIL
```

The diagnostic used an acceptance threshold of 0.1 degrees position error and 0.1 degrees/second velocity error. It failed the position threshold and passed the velocity threshold at the final sample.

**Classification:** reported local diagnostic result; not an Exoskeleton-run benchmark and not a browser-runtime measurement. It establishes that this particular constant-velocity recurrence test did not meet the chosen position-error criterion. It does not yet isolate initialization, transient lag, event-timing effects, or model-inference effects.

A follow-up stationary/reverse-velocity diagnostic was proposed but was **not run** in this session.

## 7. Existing Python harness discrepancy

The pasted `worker_test.py` is a standalone Python script that sends synthetic telemetry directly to the local llama.cpp HTTP endpoint. It does not use an Exoskeleton capability lifecycle or Exoskeleton telemetry.

Its embedded synthetic data starts with `phi = 180.0` and inferred ratios near `2.0`. The actual JavaScript gear plant shown in this session uses `PHI0 = 0` and `RATIO = 1.5`.

Therefore its synthetic data is inconsistent with the observed gear plant and must not be used as the authoritative Kinetics Observer benchmark. The user explicitly rejected using a standalone harness as the experiment architecture. Do not migrate this script into Exoskeleton as a parallel runtime.

## 8. Required next steps

1. Inspect the current source of `ingeniosity-A2A/Exoskeleton`; identify the active capability registration, execution, lifecycle, telemetry, and model-provider interfaces.
2. Verify whether the local `~/Ava007/packages/amos` workspace is part of the active implementation or a separate/historical workspace. Do not assume.
3. Integrate the Kinetics Observer as an Exoskeleton-executed experiment using existing interfaces.
4. Feed the experiment actual deterministic gear state and measured events, not inconsistent synthetic samples.
5. Keep three evaluation planes separate:
   - deterministic plant and observer mathematics;
   - Exoskeleton orchestration/lifecycle/telemetry performance;
   - LFM3 model inference performance.
6. Measure stationary convergence, constant-velocity tracking, reversal, frame-delta variation, ratio identification, and 720-degree alignment.
7. Record exact commit, environment, command, raw output, accuracy, latency, allocations/copies, CPU and memory where available.
8. Only claim zero-copy behavior when the relevant boundary, representation, copy counts, and allocation measurements support it.

## 9. Explicit non-claims and exclusions

- No Exoskeleton-native Kinetics benchmark has been run yet.
- No Exoskeleton integration has been implemented or verified by this session.
- No source files in the local Termux project were modified or uploaded by this record.
- No standalone Python harness is accepted as the experiment architecture.
- No zero-copy performance claim is established.
- No model-based observer correction or ratio identification has been validated.
- No bridge, WebSocket service, firewall, or unrelated runtime change is authorized by this experiment record.
- Existing AVA-007 manifestos and authority documents are outside the scope of this record and must not be rewritten.

This record preserves the session's findings and decisions. It does not substitute for source integration, runtime tests, or a reproducible Exoskeleton benchmark.

## 10. Addendum — lifecycle-executed benchmark (run later the same day)

This addendum supersedes §8 items 1 and 3 for the observer plane and qualifies the
matching non-claim in §9. Sections 2–7 remain the record of what was observed at
the time and are not rewritten.

The experiment is now executed through Exoskeleton.
`packages/capabilities/bench/run-kinetics-bench.mjs` registers the gear plant and
the observer as capabilities in `CapabilityRegistry` and runs every step through
`CapabilityLifecycle` (validate → resolve → allocate → execute → observe →
validate_outcome → release → complete), emitting `exoskeleton.lifecycle.event/1.0`
telemetry. There is no standalone measurement loop, no parallel Python runtime and
no direct model call treated as an execution.

Command: `node packages/capabilities/bench/run-kinetics-bench.mjs`
Artifact: `packages/capabilities/bench/results/2026-11-05T10-32-23-694Z-911be8655b88-kinetics.json`

| Scenario | Final position error | Final velocity error | Worst transient |
|---|---:|---:|---:|
| Stationary, 10 deg | 0.000 deg | 0.000 deg/s | 0.000 deg |
| Constant velocity, 30 deg/s | -0.368508 deg | +0.019724 deg/s | 1.519501 deg (frame 9) |
| Reversal at frame 300 | +0.368508 deg | -0.019724 deg/s | 3.407509 deg (frame 308) |
| Frame jitter, 6 intervals rejected | -1.526582 deg | -12.879891 deg/s | 6.264617 deg (frame 486) |

Structural result: 21/21 checks pass (2400 executions, 8 events each, one
allocation and one release per execution, phase order monotonic, unauthorized
call denied, duplicate event deduplicated, stale generation rejected, oversized
interval not integrated, unknown capability refused). Exit code 0.

Findings:

1. The §6 diagnostic reproduces exactly: -0.368508 deg at the final sample,
   velocity error +0.019724 deg/s. The position criterion (0.1 deg) is missed, the
   velocity criterion (0.1 deg/s) is met — the same split the diagnostic reported.
2. The residual is velocity-proportional: the reversal scenario ends at the exact
   negation (+0.368508 deg, -0.019724 deg/s), so it is a tracking-lag term rather
   than accumulating drift.
3. The lag is frame-interval dependent: 12.284 ms equivalent lag at 1/60 s,
   8.333 ms at 1/120 s, 4.167 ms at 1/240 s. Discrete error eigenvalues remain
   0.9 at 1/60 s and 0.5 at the 0.25 s ceiling — inside the unit circle at every
   accepted interval, so this is not marginal stability.
4. Reconstructing the measurement across the frame reduces the residual to
   8.333 ms but does not clear the 0.1 deg criterion, so measurement hold alone
   does not explain it; the remainder is the one-substep forward-Euler
   discretisation of a ramp. That reconstruction is a diagnostic only: it uses the
   next sample and is not behaviour a sampling sensor provides at substep time.
5. Rejecting intervals above 0.25 s is safe (nothing is integrated) but leaves an
   uncorrected state error proportional to the motion skipped, with no explicit
   re-acquisition path. The jitter scenario shows this directly.
6. The lifecycle adds ~0.003 ms p50 per observer step over an unmediated
   `registry.invoke` of the same recurrence, and the observer's numeric output is
   identical to bit level through both paths.

Still not measured: LFM3 inference (no provider or runtime here), the memory plane,
any hardware or real-time scheduler, and sensor noise or dropout (the measurement
model is noiseless by construction). No zero-copy, actuation-safety or sensor-fusion
claim follows from this addendum, and a passing threshold would not authorize
actuation.
