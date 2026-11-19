/**
 * Separate process that writes durable lifecycle telemetry and exits.
 *
 * Used to prove restart recovery: each invocation is a real process boundary,
 * and the parent verifies the persisted file between and after them.
 *
 *   node packages/capabilities/bench/telemetry-session.mjs <path> <count>
 */
import { CapabilityRegistry } from '../dist/registry.js';
import { CapabilityLifecycle } from '../dist/lifecycle.js';
import { JsonlEventSink } from '../dist/durable_sink.js';

const path = process.argv[2];
const count = Number(process.argv[3] ?? 25);
if (!path || !Number.isFinite(count) || count <= 0) {
  process.stderr.write('usage: telemetry-session.mjs <path> <count>\n');
  process.exit(2);
}

const registry = new CapabilityRegistry();
registry.register({
  name: 'telemetry.sample',
  kind: 'tool',
  description: 'Deterministic sample work used only to produce telemetry.',
  async invoke(req) {
    const t0 = performance.now();
    return {
      ok: true,
      capability: 'telemetry.sample',
      data: { n: req.input.n ?? null },
      latencyMs: performance.now() - t0,
    };
  },
});

const sink = new JsonlEventSink(path);
const lifecycle = new CapabilityLifecycle({ registry, sink });
let events = 0;
for (let i = 0; i < count; i += 1) {
  const result = await lifecycle.execute({ capability: 'telemetry.sample', input: { n: i } });
  events += result.eventCount;
  // Durability boundary: the file is fsynced after every execution.
  sink.flush();
}
sink.close();

process.stdout.write(`${JSON.stringify({ path, executions: count, events })}\n`);
