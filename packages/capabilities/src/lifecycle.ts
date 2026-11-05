/**
 * Capability execution lifecycle (docs/CAPABILITY_LAYER.md).
 *
 *   validate -> resolve -> allocate -> execute -> observe -> validate_outcome
 *        \_______________________________ interrupt / cancel ______________/
 *                                   |
 *                              release (always)
 *
 * This module does not replace or duplicate `CapabilityRegistry`. Resolution is
 * delegated to the registry; the lifecycle adds the guarantees the registry
 * deliberately does not provide: contract validation, grant checks, bounded
 * execution, cooperative cancellation, guaranteed resource release, and
 * versioned trace-correlated events.
 *
 * It confers no policy authority. Grants are capability-level scopes supplied
 * by the caller; governing authorization belongs to Cybernetic-Ava007.
 */

import type {
  CapabilityHandler,
  CapabilityObservation,
  CapabilityRequest,
  CapabilitySignal,
} from './types.js';
import type { CapabilityRegistry } from './registry.js';
import type {
  EventSink,
  LifecycleErrorCode,
  LifecycleEvent,
  LifecyclePhase,
  LifecycleStatus,
} from './events.js';
import { LIFECYCLE_EVENT_SCHEMA, MemoryEventSink } from './events.js';

/** Public name kept for callers; the structural type lives with the contract. */
export type LifecycleSignal = CapabilitySignal;

/**
 * Abort fan-out used internally. Node ships AbortController, but this package
 * pins no DOM/Node types, so the channel implements the same structural subset
 * and can additionally be aborted by the lifecycle itself on timeout.
 */
class AbortChannel implements CapabilitySignal {
  private readonly listeners = new Set<() => void>();
  private abortedFlag = false;

  get aborted(): boolean {
    return this.abortedFlag;
  }

  abort(): void {
    if (this.abortedFlag) return;
    this.abortedFlag = true;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // One faulty listener must not prevent the others from observing abort.
      }
    }
    this.listeners.clear();
  }

  addEventListener(_type: 'abort', listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'abort', listener: () => void): void {
    this.listeners.delete(listener);
  }
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export type Validator = (value: Record<string, unknown>) => ValidationIssue[];

export interface Allocation {
  /** Names of the resources held; recorded in the release event. */
  resources: string[];
  release: () => Promise<void> | void;
}

export interface NormalizedRequest {
  capability: string;
  input: Record<string, unknown>;
  traceId: string;
  generationId: number;
  grants: string[];
}

export interface CapabilityContract {
  name: string;
  /** Semantic version of the contract, recorded on every validate event. */
  version: string;
  timeoutMs?: number;
  idempotent?: boolean;
  requiresGrants?: string[];
  validateInput?: Validator;
  validateOutput?: Validator;
  allocate?: (req: NormalizedRequest) => Promise<Allocation> | Allocation;
}

export interface LifecycleRequest {
  capability: string;
  input: Record<string, unknown>;
  generationId?: number;
  traceId?: string;
  timeoutMs?: number;
  grants?: string[];
  signal?: LifecycleSignal;
}

export interface LifecycleResult {
  ok: boolean;
  capability: string;
  data: Record<string, unknown>;
  error?: string;
  errorCode?: LifecycleErrorCode;
  latencyMs: number;
  traceId: string;
  generationId: number;
  cleanup: 'released' | 'failed' | 'not_required';
  eventCount: number;
  /** True when the provider-facing signal was aborted (timeout or cancellation). */
  abortPropagated: boolean;
  /**
   * `settled`: the provider stopped before release. `pending`: it outlived the
   * bounded drain and may still be running, so cleanup did not wait for it.
   */
  workDrain: 'none' | 'settled' | 'pending';
  events: LifecycleEvent[];
}

type Outcome =
  | { kind: 'ok'; value: CapabilityObservation }
  | { kind: 'error'; error: string }
  | { kind: 'timeout' }
  | { kind: 'cancelled' };

const DEFAULT_TIMEOUT_MS = 30_000;
/** How long aborted work may take to unwind before resources are released anyway. */
const DEFAULT_DRAIN_MS = 250;

export class CapabilityLifecycle {
  private readonly registry: CapabilityRegistry;
  private readonly sink: EventSink;
  private readonly contracts = new Map<string, CapabilityContract>();
  private readonly defaultTimeoutMs: number;
  private readonly drainMs: number;
  private generation = 0;

  constructor(options: {
    registry: CapabilityRegistry;
    sink?: EventSink;
    defaultTimeoutMs?: number;
    /** Bounded wait for aborted provider work to settle before release. */
    drainMs?: number;
  }) {
    this.registry = options.registry;
    this.sink = options.sink ?? new MemoryEventSink();
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.drainMs = options.drainMs ?? DEFAULT_DRAIN_MS;
  }

  registerContract(contract: CapabilityContract): void {
    if (this.contracts.has(contract.name)) {
      throw new Error(`contract already registered: ${contract.name}`);
    }
    this.contracts.set(contract.name, contract);
  }

  contract(name: string): CapabilityContract | undefined {
    return this.contracts.get(name);
  }

  async execute(request: LifecycleRequest): Promise<LifecycleResult> {
    const startedAt = performance.now();
    const traceId = request.traceId ?? this.newTraceId();
    const generationId = request.generationId ?? (this.generation += 1);
    const capability = request.capability;
    const events: LifecycleEvent[] = [];
    let seq = 0;
    let abortPropagated = false;
    let workDrain: LifecycleResult['workDrain'] = 'none';

    const emit = (
      phase: LifecyclePhase,
      status: LifecycleStatus,
      durationMs: number | null = null,
      errorCode: LifecycleErrorCode | null = null,
      detail: Record<string, unknown> = {},
    ): void => {
      seq += 1;
      const event: LifecycleEvent = {
        schema: LIFECYCLE_EVENT_SCHEMA,
        eventId: `${traceId}:${seq}`,
        traceId,
        generationId,
        capability,
        seq,
        phase,
        status,
        atMs: performance.now() - startedAt,
        durationMs,
        errorCode,
        detail,
      };
      events.push(event);
      // Telemetry failure is isolated: it must never change execution outcome.
      try {
        this.sink.emit(event);
      } catch {
        /* sink failure recorded nowhere by design; see docs/LIFECYCLE_AND_TELEMETRY.md */
      }
    };

    const build = (
      ok: boolean,
      errorCode: LifecycleErrorCode | null,
      error: string | undefined,
      data: Record<string, unknown>,
      cleanup: LifecycleResult['cleanup'],
    ): LifecycleResult => ({
      ok,
      capability,
      data,
      error,
      errorCode: errorCode ?? undefined,
      latencyMs: performance.now() - startedAt,
      traceId,
      generationId,
      cleanup,
      eventCount: events.length,
      abortPropagated,
      workDrain,
      events,
    });

    const contract = this.contracts.get(capability);
    const grants = request.grants ?? [];

    // 1. validate -----------------------------------------------------------
    const validateStart = performance.now();
    if (contract) {
      const missing = (contract.requiresGrants ?? []).filter((grant) => !grants.includes(grant));
      if (missing.length > 0) {
        emit('validate', 'error', performance.now() - validateStart, 'AUTHORIZATION_DENIED', { missing });
        return build(false, 'AUTHORIZATION_DENIED', `missing grant(s): ${missing.join(', ')}`, {}, 'not_required');
      }
      const issues = contract.validateInput ? contract.validateInput(request.input) : [];
      if (issues.length > 0) {
        emit('validate', 'error', performance.now() - validateStart, 'INVALID_INPUT', { issues });
        return build(false, 'INVALID_INPUT', issues.map((i) => `${i.path}: ${i.message}`).join('; '), {}, 'not_required');
      }
      emit('validate', 'ok', performance.now() - validateStart, null, {
        contractVersion: contract.version,
        grants,
      });
    } else {
      // Legacy registration: no schema to validate. Reported honestly, not hidden.
      emit('validate', 'ok', performance.now() - validateStart, null, {
        contractVersion: null,
        schemaValidated: false,
      });
    }

    // 2. resolve ------------------------------------------------------------
    const handler: CapabilityHandler | undefined = this.registry.resolve(capability);
    if (!handler) {
      emit('resolve', 'error', null, 'UNKNOWN_CAPABILITY', { registered: this.registry.list().length });
      return build(false, 'UNKNOWN_CAPABILITY', `unknown capability: ${capability}`, {}, 'not_required');
    }
    emit('resolve', 'ok', null, null, { kind: handler.kind, registered: this.registry.list().length });

    // 3. allocate -----------------------------------------------------------
    let allocation: Allocation | undefined;
    if (contract?.allocate) {
      const allocateStart = performance.now();
      try {
        allocation = await contract.allocate({ capability, input: request.input, traceId, generationId, grants });
      } catch (error) {
        emit('allocate', 'error', performance.now() - allocateStart, 'ALLOCATION_FAILED', { error: String(error) });
        return build(false, 'ALLOCATION_FAILED', String(error), {}, 'not_required');
      }
      emit('allocate', 'ok', performance.now() - allocateStart, null, { resources: allocation.resources });
    } else {
      emit('allocate', 'ok', 0, null, { resources: [] });
    }

    // 4. execute ------------------------------------------------------------
    const timeoutMs = request.timeoutMs ?? contract?.timeoutMs ?? this.defaultTimeoutMs;
    const executeStart = performance.now();
    let outcome: Outcome;
    let data: Record<string, unknown> = {};
    let errorCode: LifecycleErrorCode | null = null;
    let errorText: string | undefined;

    // Cancellation is propagated to the provider, not merely applied to the
    // awaiting caller: the handler receives a signal the lifecycle aborts on
    // timeout or caller cancellation, and resources are released only after the
    // work has settled or the bounded drain has elapsed.
    const channel = new AbortChannel();
    const callerSignal = request.signal;
    const onCallerAbort = (): void => channel.abort();
    if (callerSignal) {
      if (callerSignal.aborted) channel.abort();
      else callerSignal.addEventListener('abort', onCallerAbort);
    }

    if (channel.aborted) {
      abortPropagated = true;
      outcome = { kind: 'cancelled' };
      emit('interrupt', 'cancelled', 0, 'CANCELLED', { stage: 'pre-execute', handlerInvoked: false });
    } else {
      const payload: CapabilityRequest = {
        capability,
        input: request.input,
        generationId,
        traceId,
        signal: channel,
      };
      const work = Promise.resolve().then(() => handler.invoke(payload));
      // Keep a settlement observer so a rejected provider cannot surface as an
      // unhandled rejection while the lifecycle is still draining it.
      work.catch(() => {});
      outcome = await this.race(work, timeoutMs, channel);
      if (outcome.kind === 'timeout' || outcome.kind === 'cancelled') {
        workDrain = (await this.drain(work)) ? 'settled' : 'pending';
      } else {
        workDrain = 'settled';
      }
      callerSignal?.removeEventListener('abort', onCallerAbort);
    }
    abortPropagated = channel.aborted;

    const executeMs = performance.now() - executeStart;
    if (outcome.kind === 'ok') {
      data = outcome.value.data ?? {};
      if (!outcome.value.ok) {
        errorCode = 'HANDLER_ERROR';
        errorText = outcome.value.error ?? 'handler reported failure';
      }
      emit('execute', errorCode ? 'error' : 'ok', executeMs, errorCode, {
        reportedOk: outcome.value.ok,
        abortPropagated,
        workDrain,
      });
    } else if (outcome.kind === 'timeout') {
      errorCode = 'TIMEOUT';
      errorText = `timed out after ${timeoutMs}ms`;
      emit('execute', 'timeout', executeMs, 'TIMEOUT', { timeoutMs, abortPropagated, workDrain });
    } else if (outcome.kind === 'cancelled') {
      errorCode = 'CANCELLED';
      errorText = 'execution cancelled';
      emit('execute', 'cancelled', executeMs, 'CANCELLED', { cooperative: true, abortPropagated, workDrain });
    } else {
      errorCode = 'HANDLER_ERROR';
      errorText = outcome.error;
      emit('execute', 'error', executeMs, 'HANDLER_ERROR', { error: outcome.error, abortPropagated, workDrain });
    }

    // 5. observe ------------------------------------------------------------
    emit('observe', 'ok', null, null, { latencyMs: executeMs, dataKeys: Object.keys(data).length });

    // 6. validate_outcome ---------------------------------------------------
    if (!errorCode && contract?.validateOutput) {
      const outStart = performance.now();
      const issues = contract.validateOutput(data);
      if (issues.length > 0) {
        errorCode = 'INVALID_OUTPUT';
        errorText = issues.map((i) => `${i.path}: ${i.message}`).join('; ');
        emit('validate_outcome', 'error', performance.now() - outStart, 'INVALID_OUTPUT', { issues });
      } else {
        emit('validate_outcome', 'ok', performance.now() - outStart, null, {});
      }
    } else {
      emit('validate_outcome', 'ok', 0, null, { validated: Boolean(contract?.validateOutput) && !errorCode });
    }

    // 7. release (always, exactly once) -------------------------------------
    let cleanup: LifecycleResult['cleanup'] = allocation ? 'released' : 'not_required';
    if (allocation) {
      const releaseStart = performance.now();
      try {
        await allocation.release();
        emit('release', 'ok', performance.now() - releaseStart, null, { resources: allocation.resources });
      } catch (error) {
        cleanup = 'failed';
        emit('release', 'error', performance.now() - releaseStart, 'CLEANUP_ERROR', {
          resources: allocation.resources,
          error: String(error),
        });
        // A cleanup failure is surfaced but does not erase the primary outcome:
        // the handler's result stands, so `ok` is not rewritten by cleanup. The
        // failure travels on the release event and on the complete event status.
      }
    } else {
      emit('release', 'ok', 0, null, { resources: [], note: 'no allocation' });
    }

    emit('complete', errorCode || cleanup === 'failed' ? 'error' : 'ok', performance.now() - startedAt, errorCode ?? (cleanup === 'failed' ? 'CLEANUP_ERROR' : null), {
      cleanup,
    });
    return build(errorCode === null, errorCode, errorText, data, cleanup);
  }

  /** Race handler work against the timeout and the provider-facing channel. */
  private race(work: Promise<CapabilityObservation>, timeoutMs: number, channel: AbortChannel): Promise<Outcome> {
    return new Promise<Outcome>((resolve) => {
      let settled = false;
      let timedOut = false;
      let timer: unknown;
      const detach = (): void => {
        if (timer !== undefined) clearTimeout(timer);
        channel.removeEventListener('abort', onAbort);
      };
      const finish = (outcome: Outcome): void => {
        if (settled) return;
        settled = true;
        detach();
        resolve(outcome);
      };
      const onAbort = (): void => finish(timedOut ? { kind: 'timeout' } : { kind: 'cancelled' });
      work.then(
        (value) => finish({ kind: 'ok', value }),
        (error) => finish({ kind: 'error', error: String(error) }),
      );
      channel.addEventListener('abort', onAbort);
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          timedOut = true;
          // Abort the provider before resolving so cooperative work stops.
          channel.abort();
          finish({ kind: 'timeout' });
        }, timeoutMs);
      }
    });
  }

  /**
   * Wait (bounded) for aborted work to unwind. True when the provider settled,
   * false when it outlived the drain and may still be running.
   */
  private drain(work: Promise<CapabilityObservation>): Promise<boolean> {
    return Promise.race([
      work.then(
        () => true,
        () => true,
      ),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), this.drainMs)),
    ]);
  }

  private newTraceId(): string {
    this.traceSeq += 1;
    return `trace-${this.traceSeq.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private traceSeq = 0;
}
