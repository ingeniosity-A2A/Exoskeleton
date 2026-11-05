/**
 * Kinetics Observer benchmark — observer plane, executed through Exoskeleton.
 *
 * Everything here runs through the existing capability layer: capabilities are
 * registered in `CapabilityRegistry`, every step is executed by
 * `CapabilityLifecycle` (validate -> resolve -> allocate -> execute -> observe ->
 * validate_outcome -> release -> complete), and telemetry is emitted to a
 * `MemoryEventSink` as versioned events. There is no parallel runtime, no
 * shadow scheduler, and no standalone measurement loop outside the lifecycle.
 *
 * Subject under test is the deterministic 24:16 gear plant and the two-state
 * position/velocity observer described in
 * Cybernetic-Ava007 docs/AVA007_KINETIC_STANDARD.md and the Kinetics Observer
 * experiment record. The plant law and gains are inputs, not results:
 *
 *   phi = PHI0 - theta * RATIO                      (RATIO = 1.5)
 *   error = measuredTheta - estTheta
 *   estTheta += (estOmega + L1 * error) * h         (L1 = 12, L2 = 36)
 *   estOmega += L2 * error * h
 *
 * Frame intervals are subdivided into steps no larger than 0.01 s; nonpositive
 * intervals and intervals above 0.25 s are rejected, as specified.
 *
 *   node packages/capabilities/bench/run-kinetics-bench.mjs
 *
 * Accuracy thresholds are the ones set in the experiment record (0.1 deg
 * position, 0.1 deg/s velocity) and are NOT adjusted here to make a scenario
 * pass. A scenario that misses its threshold is reported as a finding.
 * Structural integrity is separate: if lifecycle wiring, release, telemetry or
 * a denial check fails, the runner exits non-zero.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

import { CapabilityRegistry } from '../dist/registry.js';
import { CapabilityLifecycle } from '../dist/lifecycle.js';
import { MemoryEventSink } from '../dist/events.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GRANT = 'kinetics.observe';
const CAP_PLANT = 'kinetics.plant.step';
const CAP_OBSERVER = 'kinetics.observer.step';
const CAP_RAW = 'kinetics.observer.step.unmediated';

/** Deterministic gear definition (values are inputs, not measured results). */
const GEAR = Object.freeze({ TEETH_A: 24, TEETH_B: 16, RATIO: 1.5, RA: 48, RB: 32, D: 80, PHI0: 0 });
/** Observer gains from the experiment record. */
const OBSERVER = Object.freeze({ L1: 12, L2: 36, MAX_SUBSTEP_SEC: 0.01, MAX_FRAME_SEC: 0.25 });
/** Acceptance thresholds carried over from the experiment record. */
const THRESHOLDS = Object.freeze({ position_deg: 0.1, velocity_deg_per_s: 0.1 });

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
const ALIGNMENT_A_DEG = (360 * GEAR.TEETH_B) / gcd(GEAR.TEETH_A, GEAR.TEETH_B);
const plantPhi = (theta) => GEAR.PHI0 - theta * GEAR.RATIO;

const now = () => performance.now();
const round = (value, places = 6) => {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};
const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

function stats(samples) {
  if (samples.length === 0) return { n: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  return {
    n: sorted.length,
    mean_ms: round(sum / sorted.length),
    min_ms: round(sorted[0]),
    p50_ms: round(percentile(sorted, 50)),
    p95_ms: round(percentile(sorted, 95)),
    p99_ms: round(percentile(sorted, 99)),
    max_ms: round(sorted[sorted.length - 1]),
  };
}

/** Deterministic PRNG so jittered frame intervals reproduce exactly. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Observer as a capability-owned state machine. State lives in the runtime
 * object that the capability closes over; the benchmark never reaches in to
 * advance it, so every transition is consequence of a lifecycle execution.
 */
class ObserverRuntime {
  constructor() {
    this.initialized = false;
    this.estTheta = 0;
    this.estOmega = 0;
    this.lastGeneration = 0;
    this.lastEventId = null;
    this.acceptedFrames = 0;
    this.rejectedFrames = 0;
    this.substeps = 0;
    this.seen = new Map();
  }

  /** Domain validation for state monotonicity (§5 verified-generation rule). */
  validate(input) {
    const issues = [];
    if (typeof input.measuredTheta !== 'number' || !Number.isFinite(input.measuredTheta)) {
      issues.push({ path: 'measuredTheta', message: 'must be a finite number' });
    }
    if (typeof input.dtSec !== 'number' || !Number.isFinite(input.dtSec)) {
      issues.push({ path: 'dtSec', message: 'must be a finite number' });
    }
    if (typeof input.generation !== 'number' || !Number.isInteger(input.generation)) {
      issues.push({ path: 'generation', message: 'must be an integer' });
    } else if (input.generation < this.lastGeneration) {
      issues.push({ path: 'generation', message: `stale generation: ${input.generation} < ${this.lastGeneration}` });
    } else if (input.generation === this.lastGeneration && input.eventId !== this.lastEventId) {
      // Same generation with a different event is out of order; the same event
      // replayed is a duplicate and is handled by dedupe, not rejected.
      issues.push({ path: 'generation', message: `out-of-order event for generation ${input.generation}` });
    }
    if (typeof input.eventId !== 'string' || input.eventId.length === 0) {
      issues.push({ path: 'eventId', message: 'must be a non-empty string' });
    }
    if (input.prevTheta !== undefined && (typeof input.prevTheta !== 'number' || !Number.isFinite(input.prevTheta))) {
      issues.push({ path: 'prevTheta', message: 'must be a finite number when present' });
    }
    return issues;
  }

  step(input) {
    // Duplicate suppression: a replayed event must not advance state twice.
    if (this.seen.has(input.eventId)) {
      return { ok: true, data: { ...this.seen.get(input.eventId), deduplicated: true } };
    }

    const { measuredTheta, dtSec, generation, eventId, prevTheta, measurementMode = 'hold' } = input;

    // Reject nonpositive and oversized frame intervals rather than integrating them.
    if (!(dtSec > 0) || dtSec > OBSERVER.MAX_FRAME_SEC) {
      this.rejectedFrames += 1;
      return {
        ok: true,
        data: {
          applied: false,
          reason: dtSec > OBSERVER.MAX_FRAME_SEC ? 'interval_above_max_frame' : 'nonpositive_interval',
          dtSec,
          estTheta: this.estTheta,
          estOmega: this.estOmega,
          generation,
          deduplicated: false,
        },
      };
    }

    if (!this.initialized) {
      this.initialized = true;
      this.estTheta = measuredTheta;
      this.estOmega = 0;
      this.lastGeneration = generation;
      this.lastEventId = eventId;
      const data = {
        applied: true,
        mode: 'initialized',
        estTheta: this.estTheta,
        estOmega: this.estOmega,
        substeps: 0,
        h: 0,
        acceptedFrames: this.acceptedFrames,
        generation,
        deduplicated: false,
      };
      this.seen.set(eventId, data);
      return { ok: true, data };
    }

    const substeps = Math.max(1, Math.ceil(dtSec / OBSERVER.MAX_SUBSTEP_SEC - 1e-12));
    const h = dtSec / substeps;
    const { L1, L2 } = OBSERVER;
    // Default is the recorded behaviour: the frame's measurement is held across
    // its substeps (zero-order hold). `reconstructed` also interpolates between
    // the previous and current measurement; it is a diagnostic, not an input a
    // sampling sensor supplies at substep time.
    const reconstruct = measurementMode === 'reconstructed' && Number.isFinite(prevTheta);
    for (let i = 0; i < substeps; i += 1) {
      const measurement = reconstruct ? prevTheta + (measuredTheta - prevTheta) * ((i + 1) / substeps) : measuredTheta;
      const error = measurement - this.estTheta;
      this.estTheta += (this.estOmega + L1 * error) * h;
      this.estOmega += L2 * error * h;
    }

    this.substeps += substeps;
    this.acceptedFrames += 1;
    this.lastGeneration = generation;
    this.lastEventId = eventId;

    const data = {
      applied: true,
      mode: 'integrated',
      estTheta: this.estTheta,
      estOmega: this.estOmega,
      substeps,
      h,
      measurementMode,
      acceptedFrames: this.acceptedFrames,
      generation,
      deduplicated: false,
    };
    this.seen.set(eventId, data);
    return { ok: true, data };
  }
}

/** Registers plant + observer capabilities and returns the wired lifecycle rig. */
function createRig(observerCapabilityName = CAP_OBSERVER, { grants = [GRANT], withAllocation = true } = {}) {
  const registry = new CapabilityRegistry();
  const sink = new MemoryEventSink(100_000);
  const lifecycle = new CapabilityLifecycle({ registry, sink, defaultTimeoutMs: 5000 });
  const counters = { allocations: 0, releases: 0, generations: 0 };
  const observer = new ObserverRuntime();

  registry.register({
    name: CAP_PLANT,
    kind: 'physical',
    description: 'deterministic 24:16 gear plant state transition',
    invoke: async (req) => {
      const t0 = now();
      const theta = req.input.theta;
      return { ok: true, capability: CAP_PLANT, data: { theta, phi: plantPhi(theta) }, latencyMs: now() - t0 };
    },
  });
  lifecycle.registerContract({
    name: CAP_PLANT,
    version: '1.0.0',
    requiresGrants: [GRANT],
    validateInput: (input) =>
      typeof input.theta === 'number' && Number.isFinite(input.theta)
        ? []
        : [{ path: 'theta', message: 'must be a finite number' }],
    validateOutput: (data) =>
      Number.isFinite(data.phi) ? [] : [{ path: 'phi', message: 'plant output must be finite' }],
  });

  const observerHandler = {
    name: observerCapabilityName,
    kind: 'sensory',
    description: 'two-state position/velocity observer over gear A measurements',
    invoke: async (req) => {
      const t0 = now();
      const result = observer.step(req.input);
      return {
        ok: result.ok,
        capability: observerCapabilityName,
        data: result.data ?? {},
        error: result.error,
        latencyMs: now() - t0,
      };
    },
  };
  registry.register(observerHandler);

  if (observerCapabilityName !== CAP_RAW) {
    lifecycle.registerContract({
      name: observerCapabilityName,
      version: '1.0.0',
      requiresGrants: grants,
      idempotent: true,
      validateInput: (input) => observer.validate(input),
      validateOutput: (data) =>
        Number.isFinite(data.estTheta) && Number.isFinite(data.estOmega)
          ? []
          : [{ path: 'estTheta/estOmega', message: 'observer outputs must be finite' }],
      allocate: withAllocation
        ? () => {
            counters.allocations += 1;
            return {
              resources: ['kinetics.observer.state'],
              release: () => {
                counters.releases += 1;
              },
            };
          }
        : undefined,
    });
  }

  return { registry, lifecycle, sink, counters, observer, capability: observerCapabilityName };
}

/** Executes one plant step through the lifecycle and returns the measured phi. */
async function stepPlant(rig, theta, generation) {
  const result = await rig.lifecycle.execute({ capability: CAP_PLANT, input: { theta }, generationId: generation, grants: [GRANT] });
  if (!result.ok) throw new Error(`plant step failed: ${result.errorCode} ${result.error}`);
  return result.data.phi;
}

/**
 * Drives one scenario. Each frame is exactly one lifecycle execution of the
 * observer capability, preceded by one lifecycle execution of the plant.
 */
async function runScenario(scenario) {
  // Each scenario owns a runtime instance. Sharing one would let a scenario
  // inherit the previous end state, making its reported error meaningless.
  const rig = createRig(CAP_OBSERVER);
  const { name, frames } = scenario;
  let traceSeq = 0;
  const samples = [];
  const lifecycleLatency = [];
  const handlerLatency = [];
  const traces = [];
  const errors = [];

  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    const generation = i + 1;
    const phi = await stepPlant(rig, frame.theta, generation);
    const measured = frame.theta;
    traceSeq += 1;
    const traceId = `${name}-${traceSeq}`;
    const result = await rig.lifecycle.execute({
      capability: CAP_OBSERVER,
      input: {
        measuredTheta: measured,
        dtSec: frame.dtSec,
        generation,
        eventId: `${name}:${generation}`,
        prevTheta: frame.prevTheta,
        measurementMode: frame.measurementMode,
      },
      generationId: generation,
      traceId,
      grants: [GRANT],
    });
    traces.push({ traceId, ok: result.ok, errorCode: result.errorCode, eventCount: result.eventCount, cleanup: result.cleanup, events: result.events });
    if (!result.ok) {
      errors.push(`${traceId}: ${result.errorCode} ${result.error}`);
      continue;
    }
    lifecycleLatency.push(result.latencyMs);
    handlerLatency.push(Number(result.events.find((e) => e.phase === 'execute')?.durationMs ?? 0));
    samples.push({
      frame: i,
      theta: measured,
      phi,
      dtSec: frame.dtSec,
      applied: Boolean(result.data.applied),
      estTheta: result.data.estTheta,
      estOmega: result.data.estOmega,
      reason: result.data.reason ?? null,
    });
  }

  const appliedSamples = samples.filter((s) => s.applied);
  const errorSeries = appliedSamples.map((s) => ({ frame: s.frame, err: s.theta - s.estTheta }));
  const absErrors = errorSeries.map((p) => Math.abs(p.err));
  const afterInit = absErrors.slice(1);
  const lastViolation = errorSeries.reduce((acc, point, index) => (index > 0 && Math.abs(point.err) > THRESHOLDS.position_deg ? point.frame : acc), 0);
  const finalVelocityError = appliedSamples.length > 0 ? scenario.expectedVelocityDegPerSec - appliedSamples[appliedSamples.length - 1].estOmega : NaN;
  const worstIndex = absErrors.reduce((best, value, index) => (value > absErrors[best] ? index : best), 0);
  const worstFrame = errorSeries[worstIndex]?.frame;
  const worstSample = samples.find((s) => s.frame === worstFrame);
  const finalSample = samples[samples.length - 1];

  return {
    name,
    purpose: scenario.purpose,
    frames: frames.length,
    lifecycle_counters: { allocations: rig.counters.allocations, releases: rig.counters.releases },
    applied_frames: appliedSamples.length,
    rejected_frames: samples.length - appliedSamples.length,
    rejection_reasons: [...new Set(samples.filter((s) => !s.applied).map((s) => s.reason))],
    errors,
    accuracy: {
      final_position_error_deg: round(errorSeries.length ? errorSeries[errorSeries.length - 1].err : NaN),
      max_abs_position_error_deg: round(afterInit.length ? Math.max(...afterInit) : 0),
      rms_position_error_deg: round(afterInit.length ? Math.sqrt(afterInit.reduce((acc, e) => acc + e * e, 0) / afterInit.length) : 0),
      final_velocity_error_deg_per_s: round(finalVelocityError),
      steady_state_settle_frame: lastViolation + 1,
      max_abs_error_context: worstSample
        ? {
            frame: worstSample.frame,
            theta: round(worstSample.theta),
            est_theta: round(worstSample.estTheta),
            est_omega: round(worstSample.estOmega),
            dt_sec: worstSample.dtSec,
            error_deg: round(worstSample.theta - worstSample.estTheta),
          }
        : null,
      final_context: finalSample
        ? { frame: finalSample.frame, theta: round(finalSample.theta), est_theta: round(finalSample.estTheta), est_omega: round(finalSample.estOmega) }
        : null,
    },
    thresholds: { ...THRESHOLDS },
    verdict: {
      position_within_threshold:
        Number.isFinite(errorSeries.length ? errorSeries[errorSeries.length - 1].err : NaN) &&
        Math.abs(errorSeries[errorSeries.length - 1].err) <= THRESHOLDS.position_deg,
      velocity_within_threshold: Math.abs(finalVelocityError) <= THRESHOLDS.velocity_deg_per_s,
      max_abs_position_within_threshold: (afterInit.length ? Math.max(...afterInit) : 0) <= THRESHOLDS.position_deg,
    },
    latency: {
      lifecycle_execute: stats(lifecycleLatency),
      handler_only: stats(handlerLatency),
    },
    _traces: traces,
    _samples: samples,
  };
}

/** Discrete error-dynamics eigenvalues for forward Euler at a frame interval. */
function discreteEigenvalues(dtSec) {
  const { L1, L2 } = OBSERVER;
  const trace = 2 - L1 * dtSec;
  const det = 1 - L1 * dtSec + L2 * dtSec * dtSec;
  const disc = trace * trace - 4 * det;
  if (disc >= 0) {
    const root = Math.sqrt(disc);
    return { kind: 'real', values: [(trace + root) / 2, (trace - root) / 2] };
  }
  return { kind: 'complex', real: trace / 2, imag: Math.sqrt(-disc) / 2 };
}

function eigenvaluesMagnitude(eigen) {
  if (eigen.kind === 'real') return Math.max(...eigen.values.map(Math.abs));
  return Math.hypot(eigen.real, eigen.imag);
}

function gitInfo() {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: HERE, encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: HERE, encoding: 'utf8' }).trim().length > 0;
    return { commit_sha: commit, worktree_dirty: dirty };
  } catch {
    return { commit_sha: 'unknown', worktree_dirty: null };
  }
}

// ---------------------------------------------------------------------------
// Scenario definitions
// ---------------------------------------------------------------------------

const NOMINAL_DT = 1 / 60;

function stationaryFrames() {
  return Array.from({ length: 600 }, () => ({ theta: 10, dtSec: NOMINAL_DT }));
}

function rampFrames(velocity = 30, frames = 600, dt = NOMINAL_DT, startTheta = 10) {
  // startTheta matches the recorded diagnostic (initial measurement 10 deg) so
  // this run is directly comparable to it.
  return Array.from({ length: frames }, (_, i) => ({ theta: startTheta + velocity * i * dt, dtSec: dt }));
}

function reversalFrames() {
  const dt = NOMINAL_DT;
  const frames = [];
  let theta = 0;
  for (let i = 0; i < 600; i += 1) {
    const velocity = i < 300 ? 30 : -30;
    theta += velocity * dt;
    frames.push({ theta, dtSec: dt });
  }
  return frames;
}

function jitterFrames() {
  const rng = mulberry32(0x5eed);
  const frames = [];
  let theta = 0;
  for (let i = 0; i < 600; i += 1) {
    // Mostly accepted intervals at 0.5x-2x nominal, plus every 97th frame
    // deliberately above the 0.25 s ceiling to exercise rejection.
    const dt = i % 97 === 0 && i > 0 ? 0.4 : NOMINAL_DT * (0.5 + 1.5 * rng());
    theta += 30 * Math.min(dt, OBSERVER.MAX_FRAME_SEC);
    frames.push({ theta, dtSec: dt });
  }
  return frames;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const startedAt = new Date();
const rawRig = createRig(CAP_RAW);
const guardRig = createRig(CAP_OBSERVER);

const structural = [];
const check = (id, ok, detail) => structural.push({ id, ok: Boolean(ok), detail });

// --- Manifold: gear plant law and alignment -------------------------------
const lawAngles = [0, 5, 90, 180, 360, 540, 720, -360];
const lawSamples = lawAngles.map((theta) => ({ theta, phi: plantPhi(theta) }));
const lawMaxDeviation = Math.max(...lawSamples.map((s) => Math.abs(s.phi - -1.5 * s.theta)));
check('gear.law_exact', lawMaxDeviation <= 1e-12, `max |phi + 1.5*theta| = ${lawMaxDeviation}`);

const ratioSamples = [];
for (let theta = 5; theta <= 720; theta += 5) ratioSamples.push(-plantPhi(theta) / theta);
const identifiedRatio = ratioSamples.reduce((acc, r) => acc + r, 0) / ratioSamples.length;
const ratioDirectionSign = Math.sign(plantPhi(90) / 90);
check(
  'gear.ratio_identified',
  Math.abs(identifiedRatio - GEAR.RATIO) <= 1e-12 && ratioDirectionSign === -1,
  `identified magnitude ${identifiedRatio}, gear B direction ${ratioDirectionSign === -1 ? 'opposite' : 'same'}`,
);
check('gear.alignment_period', ALIGNMENT_A_DEG === 720, `alignment period ${ALIGNMENT_A_DEG} deg of gear A`);

const aligned = [];
for (const theta of [0, 360, 719, 720, 721, -720]) {
  const phi = plantPhi(theta);
  aligned.push({
    theta,
    phi,
    gear_a_revolutions: theta / 360,
    gear_b_revolutions: -phi / 360,
    both_marked_teeth_aligned: Number.isInteger(theta / 360) && Number.isInteger(-phi / 360),
  });
}
check(
  'gear.alignment_exact_at_period',
  aligned.find((a) => a.theta === 720).both_marked_teeth_aligned === true &&
    aligned.find((a) => a.theta === 719).both_marked_teeth_aligned === false,
  'alignment holds at 720 and not at 719',
);

// --- Scenarios through the lifecycle -------------------------------------
const stationary = await runScenario({
  name: 'stationary_convergence',
  purpose: 'initialization from first measurement, then zero-position-error convergence at rest',
  frames: stationaryFrames(),
  expectedVelocityDegPerSec: 0,
});
const ramp = await runScenario({
  name: 'constant_velocity_tracking',
  purpose: 'type-2 tracking of a 30 deg/s ramp; this is the criterion the recorded diagnostic failed',
  frames: rampFrames(30),
  expectedVelocityDegPerSec: 30,
});
const reversal = await runScenario({
  name: 'reversal_tracking',
  purpose: 'sign reversal at frame 300: recovery of position and velocity after the plant changes direction',
  frames: reversalFrames(),
  expectedVelocityDegPerSec: -30,
});
const jitter = await runScenario({
  name: 'frame_interval_variation',
  purpose: 'deterministic 0.5x-2x frame jitter plus deliberate >0.25 s intervals that must be rejected',
  frames: jitterFrames(),
  expectedVelocityDegPerSec: 30,
});

// --- Lag isolation: is the residual a discrete hold artifact? -------------
async function rampVariant(label, dtSec, measurementMode, durationSec = 10) {
  const frameCount = Math.round(durationSec / dtSec);
  const base = rampFrames(30, frameCount, dtSec);
  const frames = base.map((frame, i) => ({
    ...frame,
    prevTheta: i === 0 ? undefined : base[i - 1].theta,
    measurementMode,
  }));
  const scenario = await runScenario({
    name: label,
    purpose: `${measurementMode} measurement, dt=${dtSec.toFixed(5)} s, ${durationSec} s of 30 deg/s ramp`,
    frames,
    expectedVelocityDegPerSec: 30,
  });
  return {
    label,
    dt_sec: round(dtSec, 6),
    frames: frameCount,
    measurement_mode: measurementMode,
    final_position_error_deg: scenario.accuracy.final_position_error_deg,
    final_velocity_error_deg_per_s: scenario.accuracy.final_velocity_error_deg_per_s,
    max_abs_position_error_deg: scenario.accuracy.max_abs_position_error_deg,
    equivalent_lag_ms: round((Math.abs(scenario.accuracy.final_position_error_deg) / 30) * 1000, 3),
    position_within_threshold: scenario.verdict.position_within_threshold,
    structural_ok: scenario.errors.length === 0 && scenario.latency.lifecycle_execute.n > 0,
  };
}

const lagIsolation = [
  await rampVariant('lag_hold_dt_1_60', 1 / 60, 'hold'),
  await rampVariant('lag_reconstructed_dt_1_60', 1 / 60, 'reconstructed'),
  await rampVariant('lag_hold_dt_1_120', 1 / 120, 'hold'),
  await rampVariant('lag_hold_dt_1_240', 1 / 240, 'hold'),
];
const [lagHold60, lagReconstructed60, lagHold120, lagHold240] = lagIsolation;
const velocityProportionalResidual =
  Math.sign(ramp.accuracy.final_position_error_deg) === -Math.sign(reversal.accuracy.final_position_error_deg) &&
  Math.abs(Math.abs(ramp.accuracy.final_position_error_deg) - Math.abs(reversal.accuracy.final_position_error_deg)) <= 1e-6;
const lagFindings = {
  residual_is_velocity_proportional: velocityProportionalResidual,
  velocity_proportional_evidence: {
    constant_velocity_final_error_deg: ramp.accuracy.final_position_error_deg,
    reversal_final_error_deg: reversal.accuracy.final_position_error_deg,
  },
  equivalent_lag_ms_by_frame_rate: {
    '1/60': lagHold60.equivalent_lag_ms,
    '1/120': lagHold120.equivalent_lag_ms,
    '1/240': lagHold240.equivalent_lag_ms,
  },
  lag_scales_with_frame_interval: lagHold60.equivalent_lag_ms > lagHold120.equivalent_lag_ms && lagHold120.equivalent_lag_ms > lagHold240.equivalent_lag_ms,
  lag_ratio_60_over_120: round(lagHold60.equivalent_lag_ms / lagHold120.equivalent_lag_ms, 3),
  reconstruction_reduces_residual: lagReconstructed60.equivalent_lag_ms < lagHold60.equivalent_lag_ms,
  reconstruction_meets_threshold: lagReconstructed60.position_within_threshold,
  reconstruction_residual_ms: lagReconstructed60.equivalent_lag_ms,
  conclusion: lagReconstructed60.position_within_threshold
    ? 'The residual is a frame-interval-dependent measurement-hold artifact: it shrinks as the frame interval shrinks and is removed by reconstructing the measurement across the frame.'
    : 'The residual is frame-interval dependent and reduced, but not removed, by reconstructing the measurement across the frame; part of it is the one-substep discretisation of a ramp by forward Euler. It is not a stability failure: every discrete eigenvalue stays inside the unit circle.',
  caveat:
    'Reconstruction uses the next measurement and is therefore not an input a sampling sensor supplies at substep time. It isolates a component of the residual; it does not describe deployed behaviour, and it does not by itself establish that any particular frame rate is adequate.',
};

// --- Unmediated baseline: same observer work, no lifecycle ----------------
const rawSamples = [];
const rawLatency = [];
for (const [i, frame] of rampFrames(30).entries()) {
  const t0 = now();
  const res = await rawRig.registry.invoke({
    capability: CAP_RAW,
    input: { measuredTheta: frame.theta, dtSec: frame.dtSec, generation: i + 1, eventId: `raw:${i + 1}` },
    generationId: i + 1,
  });
  rawLatency.push(now() - t0);
  rawSamples.push({ theta: frame.theta, estTheta: res.data.estTheta });
}

// --- Determinism: identical inputs on a fresh rig reproduce bit-identical output
const replay = await runScenario({
  name: 'constant_velocity_replay',
  purpose: 'determinism check for the ramp scenario',
  frames: rampFrames(30),
  expectedVelocityDegPerSec: 30,
});
const liveEst = ramp._samples.filter((s) => s.applied).map((s) => s.estTheta);
const replayEst = replay._samples.filter((s) => s.applied).map((s) => s.estTheta);
check(
  'observer.deterministic',
  liveEst.length === replayEst.length && liveEst.every((v, i) => Object.is(v, replayEst[i])),
  `${liveEst.length} compared estimates`,
);
check(
  'observer.unmediated_matches_lifecycle',
  rawSamples.length === liveEst.length && rawSamples.every((s, i) => Math.abs(s.estTheta - liveEst[i]) <= 1e-9),
  'lifecycle adds no numeric change to the observer recurrence',
);

// --- Denial and state-integrity checks (§10 acceptance tests) -------------
const unauthorized = await guardRig.lifecycle.execute({
  capability: CAP_OBSERVER,
  input: { measuredTheta: 5, dtSec: NOMINAL_DT, generation: 1, eventId: 'guard:unauthorized' },
  generationId: 1,
});
check('guard.unauthorized_denied', unauthorized.ok === false && unauthorized.errorCode === 'AUTHORIZATION_DENIED', `${unauthorized.errorCode} ${unauthorized.error ?? ''}`.trim());
check('guard.denial_does_not_advance_state', guardRig.observer.initialized === false && guardRig.observer.estTheta === 0, 'observer state untouched after denial');

const firstAuthorized = await guardRig.lifecycle.execute({
  capability: CAP_OBSERVER,
  input: { measuredTheta: 5, dtSec: NOMINAL_DT, generation: 5, eventId: 'guard:1' },
  generationId: 5,
  grants: [GRANT],
});
check('guard.authorized_first_step', firstAuthorized.ok === true && firstAuthorized.data.mode === 'initialized', `${firstAuthorized.errorCode ?? 'ok'}`);
const estAfterFirst = guardRig.observer.estTheta;

const duplicate = await guardRig.lifecycle.execute({
  capability: CAP_OBSERVER,
  input: { measuredTheta: 5, dtSec: NOMINAL_DT, generation: 5, eventId: 'guard:1' },
  generationId: 5,
  grants: [GRANT],
});
check('guard.duplicate_idempotent', duplicate.ok === true && duplicate.data.deduplicated === true && guardRig.observer.estTheta === estAfterFirst, 'replayed event reused result and did not advance state');

const stale = await guardRig.lifecycle.execute({
  capability: CAP_OBSERVER,
  input: { measuredTheta: 40, dtSec: NOMINAL_DT, generation: 4, eventId: 'guard:stale' },
  generationId: 4,
  grants: [GRANT],
});
check('guard.stale_generation_rejected', stale.ok === false && stale.errorCode === 'INVALID_INPUT', `${stale.errorCode} ${stale.error ?? ''}`.trim());
check('guard.stale_does_not_overwrite', guardRig.observer.estTheta === estAfterFirst, 'newer verified state preserved');

const oversized = await guardRig.lifecycle.execute({
  capability: CAP_OBSERVER,
  input: { measuredTheta: 40, dtSec: 0.5, generation: 6, eventId: 'guard:oversized' },
  generationId: 6,
  grants: [GRANT],
});
check('guard.oversized_interval_rejected', oversized.ok === true && oversized.data.applied === false && oversized.data.reason === 'interval_above_max_frame', 'interval above 0.25 s was not integrated');

const unknown = await guardRig.lifecycle.execute({
  capability: 'kinetics.does.not.exist',
  input: {},
  generationId: 7,
  grants: [GRANT],
});
check('guard.unknown_capability', unknown.ok === false && unknown.errorCode === 'UNKNOWN_CAPABILITY', `${unknown.errorCode}`);

// --- Telemetry integrity ---------------------------------------------------
const allTraces = [...stationary._traces, ...ramp._traces, ...reversal._traces, ...jitter._traces];
const expectedPhases = ['validate', 'resolve', 'allocate', 'execute', 'observe', 'validate_outcome', 'release', 'complete'];
const badOrder = allTraces.filter((trace) => {
  const phases = trace.events.map((e) => e.phase);
  const seqs = trace.events.map((e) => e.seq);
  const monotonicAt = trace.events.every((e, i, arr) => i === 0 || e.atMs >= arr[i - 1].atMs);
  return JSON.stringify(phases) !== JSON.stringify(expectedPhases) || !seqs.every((s, i) => s === i + 1) || !monotonicAt;
});
check('telemetry.phase_order', badOrder.length === 0, `${allTraces.length} traces, ${badOrder.length} deviations`);
check('telemetry.trace_correlation', allTraces.every((t) => t.events.every((e) => e.traceId === t.traceId && e.generationId >= 1)), 'every event carries its trace and a positive generation');
check('telemetry.event_count', allTraces.every((t) => t.eventCount === expectedPhases.length), `expected ${expectedPhases.length} events per execution`);

// --- Release integrity -----------------------------------------------------
const expectedReleases = allTraces.length;
const runCounters = [stationary, ramp, reversal, jitter].reduce(
  (acc, s) => ({
    allocations: acc.allocations + s.lifecycle_counters.allocations,
    releases: acc.releases + s.lifecycle_counters.releases,
  }),
  { allocations: 0, releases: 0 },
);
check(
  'lifecycle.release_every_execution',
  runCounters.releases === expectedReleases && runCounters.allocations === expectedReleases,
  `allocations ${runCounters.allocations}, releases ${runCounters.releases}, executions ${expectedReleases}`,
);
check('lifecycle.cleanup_reported', allTraces.every((t) => t.cleanup === 'released'), `cleanup states: ${[...new Set(allTraces.map((t) => t.cleanup))].join(',')}`);
check('lifecycle.no_errors', allTraces.every((t) => t.ok), `${allTraces.filter((t) => !t.ok).length} failed executions`);

// --- Stability -------------------------------------------------------------
const eigenNominal = discreteEigenvalues(NOMINAL_DT);
const eigenMaxFrame = discreteEigenvalues(OBSERVER.MAX_FRAME_SEC);
const stability = {
  continuous_characteristic_polynomial: 's^2 + 12s + 36 = (s + 6)^2',
  nominal_dt_sec: NOMINAL_DT,
  nominal: { ...eigenNominal, max_magnitude: round(eigenvaluesMagnitude(eigenNominal)) },
  max_accepted_frame_sec: OBSERVER.MAX_FRAME_SEC,
  max_accepted_frame: { ...eigenMaxFrame, max_magnitude: round(eigenvaluesMagnitude(eigenMaxFrame)) },
};
check(
  'observer.discrete_stability',
  stability.nominal.max_magnitude < 1 && stability.max_accepted_frame.max_magnitude < 1,
  `|lambda| nominal ${stability.nominal.max_magnitude}, at 0.25 s ${stability.max_accepted_frame.max_magnitude}`,
);

// ---------------------------------------------------------------------------
// Artifact
// ---------------------------------------------------------------------------

const scenarios = [stationary, ramp, reversal, jitter].map((s) => {
  const { _traces, _samples, ...rest } = s;
  return {
    ...rest,
    latency_delta_vs_unmediated: {
      p50_ms: round((rest.latency.lifecycle_execute.p50_ms ?? 0) - stats(rawLatency).p50_ms),
      note: 'lifecycle.execute p50 minus registry.invoke p50 for the same observer recurrence',
    },
  };
});

const rawStats = stats(rawLatency);
const accuracyCriteria = scenarios.map((s) => ({ scenario: s.name, ...s.verdict }));
const accuracyAllPass = accuracyCriteria.every(
  (c) => c.position_within_threshold && c.velocity_within_threshold && c.max_abs_position_within_threshold,
);
const structuralAllPass = structural.every((c) => c.ok);
const git = gitInfo();

const artifact = {
  schema: 'exoskeleton.kinetics.bench/1.0',
  generated_at: startedAt.toISOString(),
  plane: 'kinetics.observer',
  executed_through: 'CapabilityLifecycle (validate/resolve/allocate/execute/observe/validate_outcome/release/complete)',
  commit_sha: git.commit_sha,
  worktree_dirty: git.worktree_dirty,
  environment: {
    os: `${os.type()} ${os.release()}`,
    platform: os.platform(),
    arch: os.arch(),
    cpu_model: (os.cpus()[0] ?? {}).model ?? 'unknown',
    cpu_count: os.cpus().length,
    total_memory_bytes: os.totalmem(),
    node_version: process.version,
    v8_version: process.versions.v8,
  },
  command: 'node packages/capabilities/bench/run-kinetics-bench.mjs',
  subject: {
    gear: { ...GEAR, alignment_period_deg_a: ALIGNMENT_A_DEG, teeth_gcd: gcd(GEAR.TEETH_A, GEAR.TEETH_B) },
    observer: { ...OBSERVER },
    thresholds: { ...THRESHOLDS },
    plant_law: 'phi = PHI0 - theta * RATIO',
    observer_recurrence: 'estTheta += (estOmega + L1*error)*h; estOmega += L2*error*h',
    measurement_model: 'noiseless gear A angle; no sensor noise or dropout is modelled',
  },
  manifold: {
    law_samples: lawSamples,
    identified_ratio: round(identifiedRatio, 12),
    identified_ratio_direction: ratioDirectionSign === -1 ? 'gear_b_opposes_gear_a' : 'same_direction',
    ratio_sample_count: ratioSamples.length,
    alignment_table: aligned,
    discrete_stability: stability,
  },
  scenarios,
  lag_isolation: {
    variants: lagIsolation,
    findings: lagFindings,
  },
  unmediated_baseline: {
    capability: CAP_RAW,
    note: 'same observer recurrence invoked directly on the registry, bypassing the lifecycle; used only to separate lifecycle cost from handler cost',
    latency: rawStats,
  },
  guard_checks: structural,
  telemetry: {
    executions: allTraces.length,
    events_per_execution: expectedPhases.length,
    total_events: allTraces.reduce((acc, t) => acc + t.events.length, 0),
    phase_order: expectedPhases,
    sink: 'MemoryEventSink (in-memory bounded ring buffer; no external exporter)',
  },
  verdict: {
    benchmark_complete: true,
    structural_integrity: structuralAllPass ? 'PASS' : 'FAIL',
    accuracy_criteria: accuracyAllPass ? 'PASS' : 'FAIL',
    accuracy_summary: accuracyCriteria,
    failing_scenarios: accuracyCriteria.filter((c) => !(c.position_within_threshold && c.velocity_within_threshold && c.max_abs_position_within_threshold)).map((c) => c.scenario),
    note: 'structural_integrity gates this runner\u2019s exit code; accuracy_criteria are measured against thresholds fixed before the run and are reported, not tuned.',
  },
  planes_not_measured: {
    'lfm3.inference': 'NOT RUN — no LFM3 provider or runtime is available in this environment; no mock inference is substituted.',
    'memory.mailbox_arrow_duckdb': 'NOT RUN — the memory plane is not exercised by this runner.',
    'hardware.actuation': 'NOT RUN — no physical device, sensor, radio or real-time scheduler is present.',
    'sensor.noise_and_dropout': 'NOT RUN — the measurement model is noiseless by construction.',
  },
  non_claims: [
    'Accuracy criteria are criteria for this deterministic, noiseless, simulated plant. They are not sensor-fusion or hardware validation.',
    'The observer is a simulation subject; a passing threshold does not authorize actuation.',
    'No zero-copy, Arrow, mailbox, N-API or DuckDB claim is made by this runner.',
    'GSAP, REV.IKE and LFM3 are not involved in this measurement plane.',
    'The lag-isolation reconstruction uses the next measurement and is therefore not an input a sampling sensor supplies at substep time; it identifies the residual source, it does not describe deployed behaviour.',
  ],
};

const name = `${artifact.generated_at.replace(/[:.]/g, '-')}-${artifact.commit_sha.slice(0, 12)}-kinetics`;
mkdirSync(join(HERE, 'results'), { recursive: true });
const file = join(HERE, 'results', `${name}.json`);
writeFileSync(file, `${JSON.stringify(artifact, null, 2)}\n`);

console.log(`artifact: ${file}`);
console.log(`plane: ${artifact.plane} | structural: ${artifact.verdict.structural_integrity} | accuracy: ${artifact.verdict.accuracy_criteria}`);
for (const s of scenarios) {
  const a = s.accuracy;
  console.log(
    `${s.name.padEnd(28)} final_err=${String(a.final_position_error_deg).padStart(11)}deg vel_err=${String(a.final_velocity_error_deg_per_s).padStart(9)}deg/s ` +
      `p50=${String(s.latency.lifecycle_execute.p50_ms).padStart(6)}ms applied=${s.applied_frames}/${s.frames} ` +
      `pos_ok=${s.verdict.position_within_threshold} vel_ok=${s.verdict.velocity_within_threshold}`,
  );
}
console.log(`lag isolation: hold@1/60=${lagHold60.equivalent_lag_ms}ms reconstructed@1/60=${lagReconstructed60.equivalent_lag_ms}ms hold@1/120=${lagHold120.equivalent_lag_ms}ms hold@1/240=${lagHold240.equivalent_lag_ms}ms`);
console.log(
  `lag scales with frame interval: ${lagFindings.lag_scales_with_frame_interval} | reconstruction reduces residual: ${lagFindings.reconstruction_reduces_residual} | reconstruction meets 0.1deg: ${lagFindings.reconstruction_meets_threshold}`,
);
console.log(`guards: ${structural.filter((c) => c.ok).length}/${structural.length} passed`);
if (!structuralAllPass) {
  for (const c of structural.filter((x) => !x.ok)) console.error(`FAILED ${c.id}: ${c.detail}`);
  console.error('FATAL: structural integrity failed');
  process.exit(1);
}
if (accuracyAllPass) console.log('all accuracy criteria met');
else console.log(`accuracy criteria not met for: ${artifact.verdict.failing_scenarios.join(', ')} (recorded, not tuned)`);
