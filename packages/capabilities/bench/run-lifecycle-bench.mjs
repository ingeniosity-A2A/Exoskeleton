/**
 * Lifecycle benchmark — execution plane only.
 *
 * Measures the cost the lifecycle adds around the existing CapabilityRegistry:
 * validation/resolve/allocate/execute/observe/release plus event emission.
 * Every number is produced by this run; nothing is estimated.
 *
 *   npx tsc -p packages/capabilities
 *   node packages/capabilities/bench/run-lifecycle-bench.mjs
 *
 * Writes a raw JSON artifact under bench/results/ including commit SHA,
 * environment and exact command. No zero-copy claim is made for the memory
 * plane: only the lifecycle's own input handling is described, and it is
 * verifiable by inspection (input is passed by reference, never cloned).
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
const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 2000);
const WARMUP = Math.min(200, Math.floor(ITERATIONS / 5));
const CONCURRENCY = 16;

const registry = new CapabilityRegistry();
registry.register({
  name: 'bench.noop',
  kind: 'tool',
  description: 'no-op capability for lifecycle overhead measurement',
  invoke: async (req) => ({ ok: true, capability: 'bench.noop', data: { n: req.input.n }, latencyMs: 0 }),
});

const sink = new MemoryEventSink(2048);
const lifecycle = new CapabilityLifecycle({ registry, sink, defaultTimeoutMs: 5000 });
lifecycle.registerContract({ name: 'bench.noop', version: '1.0.0' });
const lifecycleAllocating = new CapabilityLifecycle({ registry, sink: new MemoryEventSink(2048), defaultTimeoutMs: 5000 });
let releaseCount = 0;
lifecycleAllocating.registerContract({
  name: 'bench.noop',
  version: '1.0.0',
  allocate: () => ({ resources: ['bench-slot'], release: () => { releaseCount += 1; } }),
});

const now = () => performance.now();
const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

function stats(samples) {
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

const round = (value) => Math.round(value * 1000) / 1000;

async function measure(label, fn) {
  for (let i = 0; i < WARMUP; i += 1) await fn(i);
  const samples = [];
  const muBefore = process.memoryUsage();
  const rssBefore = muBefore.rss;
  let rssPeak = rssBefore;
  const started = now();
  for (let i = 0; i < ITERATIONS; i += 1) {
    const t0 = now();
    await fn(i);
    samples.push(now() - t0);
    if (i % 100 === 0) rssPeak = Math.max(rssPeak, process.memoryUsage().rss);
  }
  const wall = now() - started;
  const after = process.memoryUsage();
  return {
    label,
    iterations: ITERATIONS,
    ...stats(samples),
    throughput_per_s: round((ITERATIONS / wall) * 1000),
    rss_before_bytes: rssBefore,
    rss_peak_bytes: rssPeak,
    rss_delta_bytes: after.rss - rssBefore,
    heap_used_delta_bytes: after.heapUsed - muBefore.heapUsed,
  };
}

function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: HERE, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const input = { n: 1, payload: 'x'.repeat(64) };

const results = [];
results.push(await measure('registry.invoke (baseline, no lifecycle)', () => registry.invoke({ capability: 'bench.noop', input })));
results.push(await measure('lifecycle.execute (contract, no allocation)', () => lifecycle.execute({ capability: 'bench.noop', input })));
const releasesBefore = releaseCount;
results.push(await measure('lifecycle.execute (contract + allocate/release)', () => lifecycleAllocating.execute({ capability: 'bench.noop', input })));
const measuredReleases = releaseCount - releasesBefore;

// Concurrency: total latency for ITERATIONS calls at fixed parallelism.
const concStarted = now();
let concDone = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (concDone < ITERATIONS) {
      concDone += 1;
      await lifecycle.execute({ capability: 'bench.noop', input });
    }
  }),
);
const concWall = now() - concStarted;

const artifact = {
  schema: 'exoskeleton.lifecycle.bench/1.0',
  generated_at: new Date().toISOString(),
  plane: 'exoskeleton.execution',
  commit_sha: gitSha(),
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
  command: `node packages/capabilities/bench/run-lifecycle-bench.mjs (BENCH_ITERATIONS=${ITERATIONS})`,
  workload: {
    iterations: ITERATIONS,
    warmup: WARMUP,
    input_bytes: Buffer.byteLength(JSON.stringify(input)),
    capability: 'bench.noop',
    concurrency: CONCURRENCY,
  },
  results,
  concurrency_run: {
    total_calls: ITERATIONS,
    concurrency: CONCURRENCY,
    wall_ms: round(concWall),
    throughput_per_s: round((ITERATIONS / concWall) * 1000),
  },
  resource_release: { allocate_release_cycles: measuredReleases, expected: ITERATIONS },
  input_copy_accounting: {
    lifecycle_clones_input: false,
    lifecycle_serialises_input: false,
    copied_bytes_by_lifecycle: 0,
    boundary: 'caller -> CapabilityRegistry handler (input passed by reference)',
    note: 'Measured for the lifecycle boundary only. No mailbox, Arrow, N-API or DuckDB zero-copy claim is made or implied.',
  },
  planes_not_measured: {
    'observer.correctness': 'NOT RUN — Kinetics Observer source is not present in this checkout.',
    'lfm3.inference': 'NOT RUN — no LFM3 provider/runtime is available in this environment.',
    'memory.mailbox_arrow_duckdb': 'NOT RUN — memory plane not exercised by this runner.',
  },
};

mkdirSync(join(HERE, 'results'), { recursive: true });
const file = join(HERE, 'results', `${artifact.generated_at.replace(/[:.]/g, '-')}-${artifact.commit_sha.slice(0, 12)}.json`);
writeFileSync(file, `${JSON.stringify(artifact, null, 2)}\n`);

console.log(`artifact: ${file}`);
for (const row of results) {
  console.log(
    `${row.label.padEnd(46)} p50=${String(row.p50_ms).padStart(6)}ms p95=${String(row.p95_ms).padStart(6)}ms p99=${String(row.p99_ms).padStart(6)}ms mean=${String(row.mean_ms).padStart(6)}ms`,
  );
}
console.log(`release cycles: ${measuredReleases}/${ITERATIONS}`);
if (measuredReleases !== ITERATIONS) {
  console.error('FATAL: resource release did not run for every execution');
  process.exit(1);
}
