/**
 * Lifecycle acceptance tests.
 *
 * Run against the compiled package so the tests exercise the same JavaScript
 * that ships:
 *   npx tsc -p packages/capabilities
 *   node --test packages/capabilities/test/lifecycle.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { CapabilityRegistry } from '../dist/registry.js';
import { CapabilityLifecycle } from '../dist/lifecycle.js';
import { MemoryEventSink, traceEvents } from '../dist/events.js';

const okObs = (name, data = {}) => ({ ok: true, capability: name, data, latencyMs: 0 });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setup({ invoke, contract, capacity } = {}) {
  const registry = new CapabilityRegistry();
  let invocations = 0;
  registry.register({
    name: 'cap.x',
    kind: 'tool',
    description: 'test capability',
    invoke: async (req) => {
      invocations += 1;
      return invoke ? invoke(req) : okObs('cap.x', { echo: req.input.n ?? null });
    },
  });
  const sink = new MemoryEventSink(capacity);
  const lifecycle = new CapabilityLifecycle({ registry, sink, defaultTimeoutMs: 60 });
  if (contract) lifecycle.registerContract({ name: 'cap.x', version: '1.2.3', ...contract });
  return { registry, sink, lifecycle, invocations: () => invocations };
}

const phases = (events) => events.map((event) => event.phase);

test('success path emits the full ordered lifecycle and releases once', async () => {
  let releases = 0;
  const { lifecycle, sink } = setup({
    contract: {
      allocate: () => ({ resources: ['slot-1'], release: () => { releases += 1; } }),
    },
  });
  const result = await lifecycle.execute({ capability: 'cap.x', input: { n: 7 } });
  assert.equal(result.ok, true);
  assert.equal(result.data.echo, 7);
  assert.equal(releases, 1);
  assert.equal(result.cleanup, 'released');
  assert.deepEqual(phases(result.events), [
    'validate', 'resolve', 'allocate', 'execute', 'observe', 'validate_outcome', 'release', 'complete',
  ]);
  assert.deepEqual(result.events.map((e) => e.seq), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(result.events.every((e) => e.schema === 'exoskeleton.lifecycle.event/1.0'));
  assert.equal(traceEvents(sink, result.traceId).length, result.eventCount);
});

test('trace and generation identifiers correlate every event', async () => {
  const { lifecycle } = setup({});
  const result = await lifecycle.execute({ capability: 'cap.x', input: {}, traceId: 'trace-fixed', generationId: 42 });
  assert.equal(result.traceId, 'trace-fixed');
  assert.equal(result.generationId, 42);
  assert.ok(result.events.every((e) => e.traceId === 'trace-fixed' && e.generationId === 42));
  const generated = await lifecycle.execute({ capability: 'cap.x', input: {} });
  assert.notEqual(generated.traceId, result.traceId);
  assert.notEqual(generated.generationId, 42);
});

test('invalid input is rejected before allocation and handler invocation', async () => {
  let allocated = 0;
  const { lifecycle, invocations } = setup({
    contract: {
      validateInput: (input) => (typeof input.n === 'number' ? [] : [{ path: 'n', message: 'must be a number' }]),
      allocate: () => { allocated += 1; return { resources: [], release: () => {} }; },
    },
  });
  const result = await lifecycle.execute({ capability: 'cap.x', input: { n: 'oops' } });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'INVALID_INPUT');
  assert.equal(result.cleanup, 'not_required');
  assert.equal(allocated, 0);
  assert.equal(invocations(), 0);
  assert.match(result.error, /n: must be a number/);
});

test('unknown capability fails closed', async () => {
  const { lifecycle } = setup({});
  const result = await lifecycle.execute({ capability: 'cap.missing', input: {} });
  assert.equal(result.errorCode, 'UNKNOWN_CAPABILITY');
  assert.equal(result.cleanup, 'not_required');
});

test('missing grant denies execution', async () => {
  const { lifecycle, invocations } = setup({ contract: { requiresGrants: ['filesystem.read'] } });
  const result = await lifecycle.execute({ capability: 'cap.x', input: {} });
  assert.equal(result.errorCode, 'AUTHORIZATION_DENIED');
  assert.equal(invocations(), 0);
  const allowed = await lifecycle.execute({ capability: 'cap.x', input: {}, grants: ['filesystem.read'] });
  assert.equal(allowed.ok, true);
});

test('handler throw is a HANDLER_ERROR and resources are still released', async () => {
  let releases = 0;
  const { lifecycle } = setup({
    invoke: () => { throw new Error('boom'); },
    contract: { allocate: () => ({ resources: ['r'], release: () => { releases += 1; } }) },
  });
  const result = await lifecycle.execute({ capability: 'cap.x', input: {} });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'HANDLER_ERROR');
  assert.match(result.error, /boom/);
  assert.equal(releases, 1);
  assert.equal(result.cleanup, 'released');
});

test('handler-reported failure maps to HANDLER_ERROR', async () => {
  const { lifecycle } = setup({ invoke: () => ({ ok: false, capability: 'cap.x', data: {}, error: 'nope', latencyMs: 0 }) });
  const result = await lifecycle.execute({ capability: 'cap.x', input: {} });
  assert.equal(result.errorCode, 'HANDLER_ERROR');
  assert.equal(result.error, 'nope');
});

test('timeout is enforced and resources are released', async () => {
  let releases = 0;
  const { lifecycle } = setup({
    invoke: () => new Promise(() => {}),
    contract: { allocate: () => ({ resources: ['r'], release: () => { releases += 1; } }) },
  });
  const started = performance.now();
  const result = await lifecycle.execute({ capability: 'cap.x', input: {}, timeoutMs: 25 });
  const elapsed = performance.now() - started;
  assert.equal(result.errorCode, 'TIMEOUT');
  assert.ok(elapsed >= 20, `expected timeout after >=20ms, got ${elapsed}`);
  assert.equal(releases, 1);
  assert.ok(result.events.some((e) => e.status === 'timeout' && e.errorCode === 'TIMEOUT'));
});

test('pre-aborted signal never invokes the handler but still releases', async () => {
  let releases = 0;
  const { lifecycle, invocations } = setup({
    contract: { allocate: () => ({ resources: ['r'], release: () => { releases += 1; } }) },
  });
  const controller = new AbortController();
  controller.abort();
  const result = await lifecycle.execute({ capability: 'cap.x', input: {}, signal: controller.signal });
  assert.equal(result.errorCode, 'CANCELLED');
  assert.equal(invocations(), 0);
  assert.equal(releases, 1);
  assert.ok(result.events.some((e) => e.phase === 'interrupt' && e.detail.handlerInvoked === false));
});

test('in-flight abort cancels and releases', async () => {
  let releases = 0;
  const { lifecycle } = setup({
    invoke: () => sleep(500).then(() => okObs('cap.x')),
    contract: { allocate: () => ({ resources: ['r'], release: () => { releases += 1; } }) },
  });
  const controller = new AbortController();
  const pending = lifecycle.execute({ capability: 'cap.x', input: {}, signal: controller.signal, timeoutMs: 5000 });
  await sleep(10);
  controller.abort();
  const result = await pending;
  assert.equal(result.errorCode, 'CANCELLED');
  assert.equal(releases, 1);
});

test('output validation rejects an unauthorized observation shape', async () => {
  let releases = 0;
  const { lifecycle } = setup({
    invoke: () => ({ ok: true, capability: 'cap.x', data: {}, latencyMs: 0 }),
    contract: {
      validateOutput: (data) => ('answer' in data ? [] : [{ path: 'answer', message: 'required' }]),
      allocate: () => ({ resources: ['r'], release: () => { releases += 1; } }),
    },
  });
  const result = await lifecycle.execute({ capability: 'cap.x', input: {} });
  assert.equal(result.errorCode, 'INVALID_OUTPUT');
  assert.equal(releases, 1);
});

test('release failure is surfaced without erasing the primary outcome', async () => {
  const { lifecycle } = setup({
    contract: { allocate: () => ({ resources: ['r'], release: () => { throw new Error('leak'); } }) },
  });
  const result = await lifecycle.execute({ capability: 'cap.x', input: {} });
  assert.equal(result.ok, true);
  assert.equal(result.cleanup, 'failed');
  const releaseEvent = result.events.find((e) => e.phase === 'release');
  assert.equal(releaseEvent.errorCode, 'CLEANUP_ERROR');
  assert.match(String(releaseEvent.detail.error), /leak/);
});

test('a throwing telemetry sink cannot break execution', async () => {
  const registry = new CapabilityRegistry();
  registry.register({ name: 'cap.x', kind: 'tool', description: 't', invoke: async () => okObs('cap.x') });
  const lifecycle = new CapabilityLifecycle({
    registry,
    sink: { emit: () => { throw new Error('exporter down'); } },
    defaultTimeoutMs: 50,
  });
  const result = await lifecycle.execute({ capability: 'cap.x', input: {} });
  assert.equal(result.ok, true);
  assert.equal(result.eventCount, 8);
});

test('concurrent executions keep independent, monotonic traces', async () => {
  const { lifecycle } = setup({ invoke: (req) => sleep(5).then(() => okObs('cap.x', { n: req.input.n })) });
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) => lifecycle.execute({ capability: 'cap.x', input: { n: i } })),
  );
  assert.equal(new Set(results.map((r) => r.traceId)).size, 20);
  for (const result of results) {
    assert.deepEqual(result.events.map((e) => e.seq), Array.from({ length: result.eventCount }, (_, i) => i + 1));
    assert.ok(result.events.every((e) => e.traceId === result.traceId));
  }
  assert.deepEqual(results.map((r) => r.data.n).sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i));
});
