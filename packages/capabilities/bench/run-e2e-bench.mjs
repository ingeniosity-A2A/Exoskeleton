#!/usr/bin/env node
/**
 * End-to-end execution and copy-accounting benchmark.
 *
 * Every number here is measured in this environment. Where a boundary cannot be
 * reached (Rust mailbox, N-API, Arrow/DuckDB, LFM3), it is recorded as NOT RUN
 * with the exact blocker instead of an estimate or a substitute.
 *
 *   npx tsc -p packages/capabilities
 *   node packages/capabilities/bench/run-e2e-bench.mjs
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CapabilityRegistry } from '../dist/registry.js';
import { CapabilityLifecycle } from '../dist/lifecycle.js';
import { MemoryEventSink, NullEventSink } from '../dist/events.js';
import { JsonlEventSink } from '../dist/durable_sink.js';
import { createSenseAudioCapability, mockAudioBackend } from '../dist/sense_audio.js';
import { codeResolveExample } from '../dist/compose_harness.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(HERE, 'results');
const REPO_ROOT = join(HERE, '..', '..', '..');
const KiB = 1024;
const MiB = 1024 * 1024;

const now = () => performance.now();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value, digits = 4) =>
  typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(digits)) : value;

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return round(sorted[index]);
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / Math.max(1, sorted.length);
  return {
    n: sorted.length,
    mean_ms: round(mean),
    p50_ms: percentile(sorted, 50),
    p95_ms: percentile(sorted, 95),
    p99_ms: percentile(sorted, 99),
    max_ms: round(sorted[sorted.length - 1] ?? null),
  };
}

function sampleMemory() {
  const usage = process.memoryUsage();
  return {
    rss_mb: round(usage.rss / MiB, 2),
    heap_used_mb: round(usage.heapUsed / MiB, 2),
    external_mb: round(usage.external / MiB, 2),
  };
}

function cpuMsSince(start) {
  const delta = process.cpuUsage(start);
  return round((delta.user + delta.system) / 1000, 2);
}

function gitInfo() {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return {
    commit_sha: (head.stdout ?? '').trim() || null,
    worktree_dirty: (status.stdout ?? '').trim().length > 0,
    worktree_state_sampled: 'before this run wrote its artifact',
  };
}

async function runBatch(count, concurrency, task) {
  let next = 0;
  const results = [];
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, count)) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= count) return;
      results.push(await task(index));
    }
  });
  await Promise.all(workers);
  return results;
}

/** Real buffer-pool resource: renting and returning actual allocations. */
function createBufferPool(slotBytes, slots) {
  const free = Array.from({ length: slots }, () => Buffer.alloc(slotBytes, 0));
  const accounting = {
    capacity: slots,
    slot_bytes: slotBytes,
    allocations: 0,
    releases: 0,
    exhausted: 0,
    peak_in_use: 0,
  };
  return {
    accounting,
    freeCount: () => free.length,
    acquire() {
      const slot = free.pop();
      if (!slot) {
        accounting.exhausted += 1;
        return null;
      }
      accounting.allocations += 1;
      accounting.peak_in_use = Math.max(accounting.peak_in_use, slots - free.length);
      return {
        bytes: slot.byteLength,
        release() {
          free.push(slot);
          accounting.releases += 1;
        },
      };
    },
  };
}

/** Real SHA-256 work over real bytes, with cooperative abort checks. */
function makeDigestCapability(options = {}) {
  const { yieldEveryBytes = 0, report = null, counters = null } = options;
  return {
    name: 'native.sha256',
    kind: 'harness',
    description: 'Real SHA-256 over caller-sized byte ranges; real CPU work, not a mock.',
    async invoke(req) {
      const started = now();
      if (counters) counters.invocations += 1;
      const total = Number(req.input.bytes ?? 0);
      const slice = 64 * KiB;
      const source = Buffer.alloc(total, 0x5a);
      const hash = createHash('sha256');
      let processed = 0;
      for (let offset = 0; offset < total; offset += slice) {
        if (req.signal?.aborted) break;
        const end = Math.min(offset + slice, total);
        // subarray is a view over the same allocation, not a copy.
        hash.update(source.subarray(offset, end));
        processed = end;
        if (yieldEveryBytes > 0 && offset > 0 && offset % yieldEveryBytes === 0) await sleep(0);
      }
      if (report) {
        report.processed = processed;
        report.total = total;
        report.stoppedAt = now();
      }
      const digest = hash.digest('hex');
      return {
        ok: true,
        capability: 'native.sha256',
        data: {
          digest,
          bytes: total,
          processed,
          stoppedEarly: processed < total,
          provider_ms: round(now() - started),
        },
        latencyMs: now() - started,
      };
    },
  };
}

function registerContracts(lifecycle, pool, report) {
  lifecycle.registerContract({
    name: 'native.sha256',
    version: '1.0.0',
    timeoutMs: 10_000,
    requiresGrants: ['capability.compute'],
    validateInput: (input) =>
      Number.isFinite(input.bytes) && input.bytes > 0
        ? []
        : [{ path: 'bytes', message: 'positive byte count required' }],
    validateOutput: (data) =>
      typeof data.digest === 'string' && /^[0-9a-f]{64}$/.test(data.digest)
        ? []
        : [{ path: 'digest', message: 'sha-256 hex required' }],
    allocate: () => {
      const lease = pool.acquire();
      if (!lease) throw new Error('buffer pool exhausted');
      return {
        resources: [`buffer-pool-slot:${lease.bytes}`],
        release: () => {
          if (report) report.releasedAt = now();
          lease.release();
        },
      };
    },
  });
  lifecycle.registerContract({
    name: 'sense.audio',
    version: '0.1.0',
    timeoutMs: 5_000,
    requiresGrants: ['capability.sensory'],
    validateInput: (input) => (typeof input.mode === 'string' ? [] : [{ path: 'mode', message: 'required' }]),
  });
  lifecycle.registerContract({
    name: 'code.resolve',
    version: '0.1.0',
    timeoutMs: 5_000,
    requiresGrants: ['capability.compose'],
    validateInput: (input) => (typeof input.task === 'string' ? [] : [{ path: 'task', message: 'required' }]),
  });
}

function makeHarness(options = {}) {
  const { poolSize = 8, drainMs = 200 } = options;
  const registry = new CapabilityRegistry();
  const pool = createBufferPool(64 * KiB, poolSize);
  const counters = { invocations: 0 };
  return { registry, pool, counters, drainMs };
}

// ---------------------------------------------------------------------------
// Gate 1 — real execution through the lifecycle
// ---------------------------------------------------------------------------

async function gate1Correctness() {
  const registry = new CapabilityRegistry();
  registry.register(createSenseAudioCapability(mockAudioBackend));
  registry.register(codeResolveExample);
  const pool = createBufferPool(64 * KiB, 8);
  const counters = { invocations: 0 };
  registry.register(makeDigestCapability({ counters }));
  const sink = new MemoryEventSink(100_000);
  const lifecycle = new CapabilityLifecycle({ registry, sink, drainMs: 250 });
  registerContracts(lifecycle, pool, null);

  const audio = await lifecycle.execute({
    capability: 'sense.audio',
    input: { mode: 'transcribe', text: 'kinetics observer' },
    grants: ['capability.sensory'],
  });
  const composed = await lifecycle.execute({
    capability: 'code.resolve',
    input: { task: 'resolve the benchmark' },
    grants: ['capability.compose'],
  });
  const digest = await lifecycle.execute({
    capability: 'native.sha256',
    input: { bytes: 256 * KiB },
    grants: ['capability.compute'],
  });
  const expectedDigest = createHash('sha256').update(Buffer.alloc(256 * KiB, 0x5a)).digest('hex');

  const denied = await lifecycle.execute({ capability: 'native.sha256', input: { bytes: 1024 } });
  const invalid = await lifecycle.execute({
    capability: 'native.sha256',
    input: { bytes: -1 },
    grants: ['capability.compute'],
  });
  const unknown = await lifecycle.execute({ capability: 'capability.missing', input: {} });

  const events = digest.events;
  const checks = [
    {
      check: 'sense.audio executes end to end through the lifecycle',
      // The shipped contract declares no allocation, so `not_required` is the
      // correct cleanup value; asserting `released` here would be inventing one.
      ok: audio.ok && audio.cleanup === 'not_required' && audio.eventCount === 8,
      detail: { ok: audio.ok, cleanup: audio.cleanup, events: audio.eventCount, allocates: false },
    },
    {
      check: 'code.resolve (composed capability) executes end to end',
      ok: composed.ok && composed.cleanup === 'not_required' && composed.data.verified === true,
      detail: { ok: composed.ok, cleanup: composed.cleanup, verified: composed.data.verified, allocates: false },
    },
    {
      check: 'native.sha256 result matches an independent SHA-256 of the same bytes',
      ok: digest.ok && digest.data.digest === expectedDigest,
      detail: { match: digest.data?.digest === expectedDigest, bytes: digest.data?.bytes },
    },
    {
      check: 'missing grant denies before provider invocation',
      ok: denied.errorCode === 'AUTHORIZATION_DENIED' && counters.invocations === 1,
      detail: { errorCode: denied.errorCode, invocations: counters.invocations },
    },
    {
      check: 'invalid input is rejected by the contract',
      ok: invalid.errorCode === 'INVALID_INPUT',
      detail: { errorCode: invalid.errorCode },
    },
    {
      check: 'unknown capability fails closed',
      ok: unknown.errorCode === 'UNKNOWN_CAPABILITY',
      detail: { errorCode: unknown.errorCode },
    },
    {
      check: 'every event correlates to one trace with contiguous seq',
      ok:
        events.every((event) => event.traceId === digest.traceId) &&
        events.every((event, index) => event.seq === index + 1) &&
        new Set(events.map((event) => event.eventId)).size === events.length,
      detail: { events: events.length, traceId: digest.traceId },
    },
    {
      check: 'event schema is the versioned contract',
      ok: events.every((event) => event.schema === 'exoskeleton.lifecycle.event/1.0'),
      detail: { schema: events[0]?.schema ?? null },
    },
    {
      check: 'pool accounting balanced across correctness runs',
      ok: pool.accounting.allocations === pool.accounting.releases && pool.freeCount() === pool.accounting.capacity,
      detail: { ...pool.accounting, free_after: pool.freeCount() },
    },
  ];

  return {
    checks,
    providers: {
      'sense.audio': { implementation: 'shipped handler', backend: mockAudioBackend.id, mock_backend: true },
      'code.resolve': { implementation: 'shipped composed harness reference', mock_backend: false },
      'native.sha256': { implementation: 'real SHA-256 over real bytes', mock_backend: false },
    },
    note: 'sense.audio runs the mock backend the repository ships. Its latency is path overhead, not inference.',
    pool_accounting: pool.accounting,
    events_per_success: events.length,
  };
}

async function gate1Latency() {
  const { registry, pool } = makeHarness({ poolSize: 64 });
  registry.register(makeDigestCapability({}));
  const sink = new MemoryEventSink(200_000);
  const lifecycle = new CapabilityLifecycle({ registry, sink, drainMs: 250 });
  registerContracts(lifecycle, pool, null);

  const workload = { capability: 'native.sha256', bytes: 256 * KiB, executions: 160 };
  const levels = [];

  for (const concurrency of [1, 4, 16, 64]) {
    // Warm-up keeps JIT noise out of the first measured level.
    for (let i = 0; i < 20; i += 1) {
      await lifecycle.execute({
        capability: workload.capability,
        input: { bytes: workload.bytes },
        grants: ['capability.compute'],
      });
    }
    const started = now();
    const cpuStart = process.cpuUsage();
    const results = await runBatch(workload.executions, concurrency, async () =>
      lifecycle.execute({
        capability: workload.capability,
        input: { bytes: workload.bytes },
        grants: ['capability.compute'],
      }),
    );
    const wallMs = now() - started;
    levels.push({
      concurrency,
      executions: results.length,
      ok: results.filter((result) => result.ok).length,
      wall_ms: round(wallMs),
      throughput_per_s: round((results.length / wallMs) * 1000, 2),
      cpu_ms: cpuMsSince(cpuStart),
      request_latency: stats(results.map((result) => result.latencyMs)),
      provider_latency: stats(results.map((result) => Number(result.data.provider_ms ?? 0))),
      memory: sampleMemory(),
    });
  }

  return {
    workload,
    grants: ['capability.compute'],
    levels,
    pool_accounting: pool.accounting,
    pool_free_after: pool.freeCount(),
  };
}

async function gate1Outcomes() {
  const outcomes = {};

  // Cooperative cancellation: the provider must observe abort and stop early.
  {
    const { registry, pool } = makeHarness();
    const report = {};
    registry.register(makeDigestCapability({ yieldEveryBytes: 512 * KiB, report }));
    const sink = new MemoryEventSink();
    const lifecycle = new CapabilityLifecycle({ registry, sink, drainMs: 400 });
    registerContracts(lifecycle, pool, report);
    const controller = new AbortController();
    const pending = lifecycle.execute({
      capability: 'native.sha256',
      input: { bytes: 24 * MiB },
      grants: ['capability.compute'],
      signal: controller.signal,
      timeoutMs: 10_000,
    });
    await sleep(30);
    controller.abort();
    const result = await pending;
    outcomes.cancellation_cooperative = {
      error_code: result.errorCode,
      abort_propagated: result.abortPropagated,
      work_drain: result.workDrain,
      bytes_total: report.total,
      bytes_processed: report.processed,
      stopped_early: report.processed < report.total,
      released_after_stop: report.releasedAt >= report.stoppedAt,
      cleanup: result.cleanup,
      pool_balanced: pool.accounting.allocations === pool.accounting.releases && pool.freeCount() === pool.accounting.capacity,
    };
  }

  // Timeout: same propagation path, triggered by the lifecycle instead.
  {
    const { registry, pool } = makeHarness();
    const report = {};
    registry.register(makeDigestCapability({ yieldEveryBytes: 512 * KiB, report }));
    const sink = new MemoryEventSink();
    const lifecycle = new CapabilityLifecycle({ registry, sink, drainMs: 400 });
    registerContracts(lifecycle, pool, report);
    const result = await lifecycle.execute({
      capability: 'native.sha256',
      input: { bytes: 24 * MiB },
      grants: ['capability.compute'],
      timeoutMs: 40,
    });
    outcomes.timeout = {
      error_code: result.errorCode,
      abort_propagated: result.abortPropagated,
      work_drain: result.workDrain,
      bytes_total: report.total,
      bytes_processed: report.processed,
      stopped_early: report.processed < report.total,
      released_after_stop: report.releasedAt >= report.stoppedAt,
      cleanup: result.cleanup,
    };
  }

  // Non-cooperative provider: it ignores the signal. Reported, not hidden.
  {
    const { registry, pool } = makeHarness();
    const report = {};
    registry.register({
      name: 'native.sha256',
      kind: 'harness',
      description: 'Ignores the abort signal on purpose.',
      async invoke(req) {
        const started = now();
        await sleep(400);
        report.settledAt = now();
        return {
          ok: true,
          capability: 'native.sha256',
          data: { digest: 'f'.repeat(64), bytes: Number(req.input.bytes ?? 0), provider_ms: round(now() - started) },
          latencyMs: now() - started,
        };
      },
    });
    const sink = new MemoryEventSink();
    const lifecycle = new CapabilityLifecycle({ registry, sink, drainMs: 100 });
    registerContracts(lifecycle, pool, report);
    const result = await lifecycle.execute({
      capability: 'native.sha256',
      input: { bytes: 1024 },
      grants: ['capability.compute'],
      timeoutMs: 30,
    });
    // Wait for the work that ignored abort before comparing timestamps, so the
    // leftover is measured rather than sampled while it is still in flight.
    await sleep(500);
    outcomes.cancellation_noncooperative = {
      error_code: result.errorCode,
      abort_propagated: result.abortPropagated,
      work_drain: result.workDrain,
      cleanup: result.cleanup,
      released_before_settle: report.releasedAt <= report.settledAt,
      leftover_ms: round(report.settledAt - report.releasedAt),
      note: 'release did not wait for work that never observed abort; the leftover is surfaced as workDrain=pending',
    };
  }

  // Provider failure with guaranteed release.
  {
    const { registry, pool } = makeHarness();
    registry.register({
      name: 'native.sha256',
      kind: 'harness',
      description: 'Throws.',
      async invoke() {
        throw new Error('provider exploded');
      },
    });
    const sink = new MemoryEventSink();
    const lifecycle = new CapabilityLifecycle({ registry, sink });
    registerContracts(lifecycle, pool, null);
    const result = await lifecycle.execute({
      capability: 'native.sha256',
      input: { bytes: 1024 },
      grants: ['capability.compute'],
    });
    outcomes.provider_failure = {
      error_code: result.errorCode,
      cleanup: result.cleanup,
      allocations: pool.accounting.allocations,
      releases: pool.accounting.releases,
    };
  }

  // Caller-level retry: the lifecycle provides no retry policy, the caller does.
  {
    const { registry, pool } = makeHarness();
    let attempts = 0;
    registry.register({
      name: 'native.sha256',
      kind: 'harness',
      description: 'Fails twice, then succeeds.',
      async invoke() {
        attempts += 1;
        if (attempts < 3) throw new Error(`transient failure ${attempts}`);
        return {
          ok: true,
          capability: 'native.sha256',
          data: { digest: 'a'.repeat(64), bytes: 1024, provider_ms: 0 },
          latencyMs: 0,
        };
      },
    });
    const sink = new MemoryEventSink();
    const lifecycle = new CapabilityLifecycle({ registry, sink });
    registerContracts(lifecycle, pool, null);
    const results = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await lifecycle.execute({
        capability: 'native.sha256',
        input: { bytes: 1024 },
        grants: ['capability.compute'],
      });
      results.push(result);
      if (result.ok) break;
    }
    outcomes.retry = {
      attempts: results.length,
      final_ok: results[results.length - 1]?.ok ?? false,
      generations_distinct: new Set(results.map((result) => result.generationId)).size === results.length,
      allocations: pool.accounting.allocations,
      releases: pool.accounting.releases,
      pool_balanced: pool.freeCount() === pool.accounting.capacity,
      note: 'the lifecycle has no retry policy; retrying is caller orchestration and was measured as such',
    };
  }

  // Mixed outcomes under concurrency with a constrained pool.
  {
    const { registry, pool } = makeHarness({ poolSize: 4 });
    registry.register(makeDigestCapability({}));
    const sink = new MemoryEventSink(100_000);
    const lifecycle = new CapabilityLifecycle({ registry, sink });
    registerContracts(lifecycle, pool, null);
    const results = await runBatch(32, 32, (index) =>
      lifecycle.execute({
        capability: 'native.sha256',
        input: { bytes: 64 * KiB },
        grants: index % 7 === 0 ? [] : ['capability.compute'],
      }),
    );
    const codes = {};
    for (const result of results) {
      const code = result.errorCode ?? 'OK';
      codes[code] = (codes[code] ?? 0) + 1;
    }
    const contiguous = results.every((result) =>
      result.events.every((event, index) => event.seq === index + 1),
    );
    outcomes.mixed_concurrency = {
      executions: results.length,
      outcomes: codes,
      pool_accounting: pool.accounting,
      pool_free_after: pool.freeCount(),
      pool_restored: pool.freeCount() === pool.accounting.capacity,
      allocations_balanced: pool.accounting.allocations === pool.accounting.releases,
      event_sequences_contiguous: contiguous,
    };
  }

  return outcomes;
}

// ---------------------------------------------------------------------------
// Gate 2 — copy boundaries reachable in this environment
// ---------------------------------------------------------------------------

async function boundaryAlias(bytes, iterations) {
  const latencies = [];
  let verified = false;
  for (let i = 0; i < iterations; i += 1) {
    const started = now();
    const buffer = new ArrayBuffer(bytes);
    const writer = new Uint8Array(buffer);
    const reader = new Uint8Array(buffer);
    writer[0] = 0xa5;
    reader[bytes - 1] = 0x5a;
    // Two views, one allocation: each sees the other's write.
    verified = writer[0] === 0xa5 && reader[0] === 0xa5 && writer[bytes - 1] === 0x5a;
    let checksum = 0;
    for (let offset = 0; offset < bytes; offset += 64 * KiB) checksum += reader[offset];
    latencies.push(now() - started);
    if (checksum === -1) throw new Error('unreachable');
  }
  return {
    id: 'js.same_allocation_alias',
    bytes,
    iterations,
    bytes_copied_per_call: 0,
    allocations_per_call: 1,
    verified_same_allocation: verified,
    latency: stats(latencies),
  };
}

async function boundaryCopyBaseline(bytes, iterations) {
  const latencies = [];
  let verified = false;
  for (let i = 0; i < iterations; i += 1) {
    const started = now();
    const source = Buffer.alloc(bytes, 0x5a);
    const copy = Buffer.from(source);
    source[0] = 0x11;
    // A copy is proven by the fact that mutating the source does not move it.
    verified = copy[0] === 0x5a && copy.byteLength === bytes;
    let checksum = 0;
    for (let offset = 0; offset < bytes; offset += 64 * KiB) checksum += copy[offset];
    latencies.push(now() - started);
    if (checksum === -1) throw new Error('unreachable');
  }
  return {
    id: 'js.copy_baseline',
    bytes,
    iterations,
    bytes_copied_per_call: bytes,
    allocations_per_call: 2,
    verified_independent_memory: verified,
    latency: stats(latencies),
    note: 'equivalent copy-based baseline for the alias boundary',
  };
}

function roundTrip(worker, message, transfer) {
  return new Promise((resolve, reject) => {
    const started = now();
    const onMessage = (reply) => {
      worker.off('message', onMessage);
      worker.off('error', onError);
      resolve({ ms: now() - started, reply });
    };
    const onError = (error) => {
      worker.off('message', onMessage);
      worker.off('error', onError);
      reject(error);
    };
    worker.on('message', onMessage);
    worker.on('error', onError);
    worker.postMessage(message, transfer);
  });
}

async function gate2WorkerBoundaries() {
  const worker = new Worker(new URL('./boundary_worker.mjs', import.meta.url));
  const bytes = 8 * MiB;
  const iterations = 10;
  const boundaries = [];

  // structured clone: a real copy
  {
    const latencies = [];
    let verified = null;
    for (let i = 0; i < iterations; i += 1) {
      const buffer = new ArrayBuffer(bytes);
      const view = new Uint8Array(buffer);
      view[0] = 0x11;
      const { ms, reply } = await roundTrip(worker, { type: 'clone', buffer });
      latencies.push(ms);
      verified = {
        main_detached: buffer.detached,
        worker_byte_length: reply.byteLength,
        main_first_byte: view[0],
        worker_first_byte_seen: reply.firstByteSeen,
        worker_first_byte_written: reply.firstByteWritten,
        copy_proven: buffer.detached === false && view[0] === 0x11,
      };
    }
    boundaries.push({
      id: 'worker.structured_clone',
      bytes,
      iterations,
      bytes_copied_per_call: bytes,
      allocations_per_call: 1,
      verified,
      latency: stats(latencies),
      note: 'postMessage without a transfer list serialises the payload into the worker heap',
    });
  }

  // transfer: ownership moves, no copy
  {
    const latencies = [];
    let verified = null;
    for (let i = 0; i < iterations; i += 1) {
      const buffer = new ArrayBuffer(bytes);
      new Uint8Array(buffer)[0] = 0x11;
      const { ms, reply } = await roundTrip(worker, { type: 'transfer', buffer }, [buffer]);
      latencies.push(ms);
      verified = {
        main_detached: buffer.detached,
        worker_byte_length: reply.byteLength,
        worker_first_byte_seen: reply.firstByteSeen,
        zero_copy_proven: buffer.detached === true && reply.byteLength === bytes && reply.firstByteSeen === 0x11,
      };
    }
    boundaries.push({
      id: 'worker.transfer',
      bytes,
      iterations,
      bytes_copied_per_call: 0,
      allocations_per_call: 1,
      verified,
      latency: stats(latencies),
      note: 'detachment of the sender buffer is the observable proof that ownership moved',
    });
  }

  // SharedArrayBuffer: same allocation in both threads, no copy
  {
    const shared = new SharedArrayBuffer(bytes);
    const counter = new Int32Array(new SharedArrayBuffer(4 * Int32Array.BYTES_PER_ELEMENT));
    const view = new Uint8Array(shared);
    const latencies = [];
    let verified = null;
    for (let i = 0; i < iterations; i += 1) {
      view[0] = 0x11;
      view[1] = 0;
      const before = counter[0];
      const { ms, reply } = await roundTrip(worker, { type: 'shared', buffer: shared, counter: counter.buffer });
      latencies.push(ms);
      verified = {
        worker_observed_main_byte: reply.observedByte,
        main_observed_worker_byte: view[1],
        counter_incremented: counter[0] === before + 1,
        same_allocation_proven: reply.observedByte === 0x11 && view[1] === 0x5a,
      };
    }
    boundaries.push({
      id: 'worker.shared_array_buffer',
      bytes,
      iterations,
      bytes_copied_per_call: 0,
      allocations_per_call: 1,
      verified,
      latency: stats(latencies),
      note: 'two-way visibility through the same allocation; concurrency safety is not established by this test',
    });
  }

  await worker.terminate();
  return boundaries;
}

async function gate2() {
  const bytes = 8 * MiB;
  const iterations = 12;
  const boundaries = [
    await boundaryAlias(bytes, iterations),
    await boundaryCopyBaseline(bytes, iterations),
    ...(await gate2WorkerBoundaries()),
  ];

  const notRun = [
    {
      id: 'rust.mailbox_producer',
      status: 'NOT RUN',
      blocker:
        'no cargo/rustc in this environment; packages/substrate-native has no built artifact, and the crate is not a dependency of any JS package',
    },
    {
      id: 'native.consumer_to_node',
      status: 'NOT RUN',
      blocker:
        'napi_bridge.rs exists but Cargo.toml declares no napi dependency, so there is no N-API build to load; no WASM build is produced either',
    },
    {
      id: 'arrow.to_duckdb',
      status: 'NOT RUN',
      blocker:
        '@duckdb/duckdb-wasm and apache-arrow are not installed (no pnpm binary, no lockfile importers); memory-chassis imports them only as types',
    },
    {
      id: 'duckdb.persistence_recovery',
      status: 'NOT RUN',
      blocker: 'no DuckDB runtime is installed, so no persistence or recovery path exists to measure',
    },
  ];

  return { boundaries, not_run: notRun };
}

// ---------------------------------------------------------------------------
// Gate 3 — full pipeline: telemetry overhead, completeness, restart recovery
// ---------------------------------------------------------------------------

async function gate3Telemetry() {
  const workload = { capability: 'native.sha256', bytes: 8 * KiB, executions: 200, concurrency: 4 };
  const sessions = [];

  const buildLifecycle = (sink) => {
    const { registry, pool } = makeHarness({ poolSize: 32 });
    registry.register(makeDigestCapability({}));
    const lifecycle = new CapabilityLifecycle({ registry, sink });
    registerContracts(lifecycle, pool, null);
    return { lifecycle, pool };
  };

  for (const [name, makeSink] of [
    ['disabled', () => new NullEventSink()],
    ['memory', () => new MemoryEventSink(200_000)],
    ['jsonl_fsync', () => new JsonlEventSink(join(RESULTS, 'telemetry-overhead.jsonl'))],
  ]) {
    if (name === 'jsonl_fsync') rmSync(join(RESULTS, 'telemetry-overhead.jsonl'), { force: true });
    const sink = makeSink();
    const { lifecycle, pool } = buildLifecycle(sink);
    const flushed = { events: 0, bytes: 0 };
    const started = now();
    const results = await runBatch(workload.executions, workload.concurrency, async () => {
      const result = await lifecycle.execute({
        capability: workload.capability,
        input: { bytes: workload.bytes },
        grants: ['capability.compute'],
      });
      if (typeof sink.flush === 'function') {
        const report = sink.flush();
        flushed.events += report.events;
        flushed.bytes += report.bytes;
      }
      return result;
    });
    const wallMs = now() - started;
    const delivered = typeof sink.events?.length === 'number' ? sink.events.length : null;
    sessions.push({
      telemetry: name,
      executions: results.length,
      ok: results.filter((result) => result.ok).length,
      wall_ms: round(wallMs),
      throughput_per_s: round((results.length / wallMs) * 1000, 2),
      request_latency: stats(results.map((result) => result.latencyMs)),
      events_expected: results.reduce((sum, result) => sum + result.eventCount, 0),
      events_retained_in_memory: delivered,
      pool_balanced: pool.accounting.allocations === pool.accounting.releases,
      pool_free_after: pool.freeCount(),
      durable: { events: flushed.events, bytes: flushed.bytes },
    });
    if (typeof sink.close === 'function') sink.close();
  }

  // Restart recovery across two separate processes.
  const recoveryPath = join(RESULTS, 'telemetry-recovery.jsonl');
  rmSync(recoveryPath, { force: true });
  const runSession = (count) => {
    const child = spawnSync(process.execPath, [join(HERE, 'telemetry-session.mjs'), recoveryPath, String(count)], {
      encoding: 'utf8',
    });
    if (child.status !== 0) {
      throw new Error(`telemetry session failed: ${child.stderr || child.stdout}`);
    }
    return JSON.parse((child.stdout ?? '').trim());
  };
  const verify = () => {
    const child = spawnSync(process.execPath, [join(HERE, 'verify-telemetry.mjs'), recoveryPath], {
      encoding: 'utf8',
    });
    return { status: child.status, report: JSON.parse((child.stdout ?? '{}').trim()), stderr: child.stderr ?? '' };
  };

  const sessionA = runSession(25);
  const afterA = verify();
  const sessionB = runSession(25);
  const afterB = verify();

  return {
    workload,
    sessions,
    restart_recovery: {
      path: 'packages/capabilities/bench/results/telemetry-recovery.jsonl',
      processes: 2,
      session_a: sessionA,
      recovery_after_a: afterA.report,
      session_b: sessionB,
      recovery_after_b: afterB.report,
      verifier_exit_status: afterB.status,
      events_total: afterB.report.events,
      traces_total: afterB.report.traces,
      duplicates: afterB.report.duplicate_event_ids,
      seq_gaps: afterB.report.seq_gaps,
      malformed: afterB.report.malformed_lines,
    },
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(RESULTS, { recursive: true });
  const git = gitInfo();
  let peakRss = 0;
  const sampler = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 25);
  sampler.unref();

  const gate1 = {
    correctness: await gate1Correctness(),
    latency: await gate1Latency(),
    outcomes: await gate1Outcomes(),
  };
  const gate2Result = await gate2();
  const gate3 = await gate3Telemetry();

  clearInterval(sampler);

  const correctnessChecks = gate1.correctness.checks;
  const failedChecks = correctnessChecks.filter((entry) => !entry.ok);
  const latencyLevelsOk = gate1.latency.levels.every((level) => level.ok === level.executions);
  const cancellation = gate1.outcomes.cancellation_cooperative;
  const timeout = gate1.outcomes.timeout;
  const nonCooperative = gate1.outcomes.cancellation_noncooperative;
  const mixed = gate1.outcomes.mixed_concurrency;

  const gate1Checks = [
    { check: 'all correctness checks pass', ok: failedChecks.length === 0, detail: { failed: failedChecks.map((entry) => entry.check) } },
    { check: 'every latency execution succeeded', ok: latencyLevelsOk, detail: { levels: gate1.latency.levels.length } },
    {
      check: 'cooperative cancellation stopped provider work before release',
      ok:
        cancellation.stopped_early === true &&
        cancellation.work_drain === 'settled' &&
        cancellation.released_after_stop === true &&
        cancellation.cleanup === 'released',
      detail: { processed: cancellation.bytes_processed, total: cancellation.bytes_total, work_drain: cancellation.work_drain },
    },
    {
      check: 'timeout aborted the provider and forced release',
      ok: timeout.error_code === 'TIMEOUT' && timeout.abort_propagated === true && timeout.stopped_early === true && timeout.cleanup === 'released',
      detail: { error_code: timeout.error_code, work_drain: timeout.work_drain },
    },
    {
      check: 'non-cooperative provider is surfaced as undrained',
      ok: nonCooperative.work_drain === 'pending' && nonCooperative.cleanup === 'released',
      detail: { work_drain: nonCooperative.work_drain, released_before_settle: nonCooperative.released_before_settle },
    },
    {
      check: 'provider failure releases resources',
      ok: gate1.outcomes.provider_failure.error_code === 'HANDLER_ERROR' && gate1.outcomes.provider_failure.allocations === gate1.outcomes.provider_failure.releases,
      detail: gate1.outcomes.provider_failure,
    },
    {
      check: 'retry under caller orchestration leaves no leaked resources',
      ok: gate1.outcomes.retry.pool_balanced === true && gate1.outcomes.retry.allocations === gate1.outcomes.retry.releases,
      detail: gate1.outcomes.retry,
    },
    {
      check: 'mixed outcomes under concurrency restore the pool',
      ok: mixed.pool_restored === true && mixed.allocations_balanced === true && mixed.event_sequences_contiguous === true,
      detail: { outcomes: mixed.outcomes, pool_free_after: mixed.pool_free_after },
    },
  ];

  const gate2Checks = [
    {
      check: 'alias views share one allocation (zero copy, verified by mutation)',
      ok: gate2Result.boundaries[0].verified_same_allocation === true && gate2Result.boundaries[0].bytes_copied_per_call === 0,
      detail: { verified: gate2Result.boundaries[0].verified_same_allocation },
    },
    {
      check: 'copy baseline copies the payload and is independent',
      ok: gate2Result.boundaries[1].verified_independent_memory === true && gate2Result.boundaries[1].bytes_copied_per_call > 0,
      detail: { bytes_copied: gate2Result.boundaries[1].bytes_copied_per_call },
    },
    {
      check: 'structured clone is a real copy',
      ok: gate2Result.boundaries[2].verified.copy_proven === true,
      detail: gate2Result.boundaries[2].verified,
    },
    {
      check: 'transfer moves ownership without copying (sender detached)',
      ok: gate2Result.boundaries[3].verified.zero_copy_proven === true,
      detail: gate2Result.boundaries[3].verified,
    },
    {
      check: 'shared buffer is the same allocation in both threads',
      ok: gate2Result.boundaries[4].verified.same_allocation_proven === true,
      detail: gate2Result.boundaries[4].verified,
    },
  ];

  const telemetry = gate3.sessions;
  const recovery = gate3.restart_recovery;
  const eventsExpected = telemetry.reduce((sum, session) => sum + session.events_expected, 0);
  const gate3Checks = [
    {
      check: 'telemetry completes 8 events per successful execution',
      ok: telemetry.every((session) => session.events_expected === session.executions * 8),
      detail: { events_expected: eventsExpected },
    },
    {
      check: 'telemetry sinks do not change execution outcome',
      ok: telemetry.every((session) => session.ok === session.executions),
      detail: telemetry.map((session) => ({ telemetry: session.telemetry, ok: session.ok })),
    },
    {
      check: 'persisted telemetry survives two separate processes',
      ok: recovery.verifier_exit_status === 0 && recovery.events_total === 400 && recovery.traces_total === 50,
      detail: { events: recovery.events_total, traces: recovery.traces_total },
    },
    {
      check: 'recovered telemetry has no duplicates, gaps or malformed lines',
      ok: recovery.duplicates === 0 && recovery.seq_gaps === 0 && recovery.malformed === 0,
      detail: { duplicates: recovery.duplicates, seq_gaps: recovery.seq_gaps, malformed: recovery.malformed },
    },
  ];

  const allChecks = [...gate1Checks, ...gate2Checks, ...gate3Checks];
  const passed = allChecks.filter((entry) => entry.ok).length;

  const artifact = {
    schema: 'exoskeleton.e2e.execution/1.0',
    generated_at: new Date().toISOString(),
    ...git,
    command: 'npx tsc -p packages/capabilities && node packages/capabilities/bench/run-e2e-bench.mjs',
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpu_count: cpus().length,
      peak_rss_mb: round(peakRss / MiB, 2),
    },
    gates: {
      gate1_execution: { checks: gate1Checks, ...gate1 },
      gate2_boundaries: { checks: gate2Checks, ...gate2Result },
      gate3_pipeline: { checks: gate3Checks, ...gate3 },
    },
    accepted: {
      checks_total: allChecks.length,
      checks_passed: passed,
      failed: allChecks.filter((entry) => !entry.ok).map((entry) => entry.check),
    },
    not_run: [
      { id: 'lfm3.provider', status: 'NOT RUN', blocker: 'no LFM3 runtime or provider exists in this repository; nothing to integrate and no mock inference is substituted' },
      { id: 'policy.authorization', status: 'NOT RUN', blocker: 'governing authorization is owned by Cybernetic-Ava007 and is not present here; only capability-level grants were exercised' },
      ...gate2Result.not_run,
      { id: 'execution_state.recovery', status: 'NOT RUN', blocker: 'telemetry recovery is persisted; there is no persisted execution state machine to restore' },
      { id: 'hardware.realtime', status: 'NOT RUN', blocker: 'no hardware, sensor or real-time scheduler is available in this environment' },
    ],
  };

  const artifactPath = join(RESULTS, 'e2e-execution.json');
  writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

  console.log(`artifact: ${artifactPath}`);
  console.log(`commit: ${artifact.commit_sha} | worktree_dirty: ${artifact.worktree_dirty}`);
  console.log(`gate 1 checks ${gate1Checks.filter((c) => c.ok).length}/${gate1Checks.length}`);
  for (const level of gate1.latency.levels) {
    console.log(
      `  concurrency ${String(level.concurrency).padStart(2)}: ${level.throughput_per_s}/s  request p50 ${level.request_latency.p50_ms}ms p95 ${level.request_latency.p95_ms}ms  provider p50 ${level.provider_latency.p50_ms}ms`,
    );
  }
  console.log(
    `  cancellation: processed ${cancellation.bytes_processed}/${cancellation.bytes_total} bytes, drain ${cancellation.work_drain}, released after stop ${cancellation.released_after_stop}`,
  );
  console.log(
    `  timeout: ${timeout.bytes_processed}/${timeout.bytes_total} bytes, drain ${timeout.work_drain}; non-cooperative drain ${nonCooperative.work_drain}`,
  );
  console.log(`gate 2 checks ${gate2Checks.filter((c) => c.ok).length}/${gate2Checks.length} (native boundaries NOT RUN)`);
  for (const boundary of gate2Result.boundaries) {
    console.log(
      `  ${boundary.id.padEnd(28)} bytes copied ${String(boundary.bytes_copied_per_call).padStart(9)}  p50 ${String(boundary.latency.p50_ms).padStart(7)}ms  p95 ${String(boundary.latency.p95_ms).padStart(7)}ms`,
    );
  }
  console.log(`gate 3 checks ${gate3Checks.filter((c) => c.ok).length}/${gate3Checks.length}`);
  for (const session of telemetry) {
    console.log(
      `  telemetry ${session.telemetry.padEnd(10)} wall ${String(session.wall_ms).padStart(8)}ms  p50 ${session.request_latency.p50_ms}ms  throughput ${session.throughput_per_s}/s`,
    );
  }
  console.log(
    `  recovery: ${recovery.events_total} events across ${recovery.traces_total} traces in 2 processes, duplicates ${recovery.duplicates}, gaps ${recovery.seq_gaps}`,
  );
  console.log(`accepted: ${passed}/${allChecks.length} checks`);
  console.log(`not run: ${artifact.not_run.map((entry) => entry.id).join(', ')}`);

  if (passed !== allChecks.length) process.exitCode = 1;
}

await main();
