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

import type { CapabilityHandler, CapabilityObservation, CapabilityRequest } from './types.js';
import type { CapabilityRegistry } from './registry.js';
import type {
  EventSink,
  LifecycleErrorCode,
  LifecycleEvent,
  LifecyclePhase,
  LifecycleStatus,
} from './events.js';
import { LIFECYCLE_EVENT_SCHEMA, MemoryEventSink } from './events.js';

/** Structural subset of AbortSignal, so the package needs no DOM/Node types. */
export interface LifecycleSignal {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void): void;
  removeEventListener(type: 'abort', listener: () => void): void;
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
  events: LifecycleEvent[];
}

type Outcome =
  | { kind: 'ok'; value: CapabilityObservation }
  | { kind: 'error'; error: string }
  | { kind: 'timeout' }
  | { kind: 'cancelled' };

const DEFAULT_TIMEOUT_MS = 30_000;

export class CapabilityLifecycle {
  private readonly registry: CapabilityRegistry;
  private readonly sink: EventSink;
  private readonly contracts = new Map<string, CapabilityContract>();
  private readonly defaultTimeoutMs: number;
  private generation = 0;

  constructor(options: { registry: CapabilityRegistry; sink?: EventSink; defaultTimeoutMs?: number }) {
    this.registry = options.registry;
    this.sink = options.sink ?? new MemoryEventSink();
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
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

    if (request.signal?.aborted) {
      outcome = { kind: 'cancelled' };
      emit('interrupt', 'cancelled', 0, 'CANCELLED', { stage: 'pre-execute', handlerInvoked: false });
    } else {
      const payload: CapabilityRequest = { capability, input: request.input, generationId };
      const work = Promise.resolve().then(() => handler.invoke(payload));
      outcome = await this.race(work, timeoutMs, request.signal);
    }

    const executeMs = performance.now() - executeStart;
    if (outcome.kind === 'ok') {
      data = outcome.value.data ?? {};
      if (!outcome.value.ok) {
        errorCode = 'HANDLER_ERROR';
        errorText = outcome.value.error ?? 'handler reported failure';
      }
      emit('execute', errorCode ? 'error' : 'ok', executeMs, errorCode, { reportedOk: outcome.value.ok });
    } else if (outcome.kind === 'timeout') {
      errorCode = 'TIMEOUT';
      errorText = `timed out after ${timeoutMs}ms`;
      emit('execute', 'timeout', executeMs, 'TIMEOUT', { timeoutMs });
    } else if (outcome.kind === 'cancelled') {
      errorCode = 'CANCELLED';
      errorText = 'execution cancelled';
      emit('execute', 'cancelled', executeMs, 'CANCELLED', { cooperative: true });
    } else {
      errorCode = 'HANDLER_ERROR';
      errorText = outcome.error;
      emit('execute', 'error', executeMs, 'HANDLER_ERROR', { error: outcome.error });
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

  /** Race handler work against a timeout and an abort signal. */
  private race(work: Promise<CapabilityObservation>, timeoutMs: number, signal?: LifecycleSignal): Promise<Outcome> {
    return new Promise<Outcome>((resolve) => {
      let settled = false;
      let timer: unknown;
      const onAbort = (): void => finish({ kind: 'cancelled' });
      const detach = (): void => {
        if (timer !== undefined) clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
      };
      const finish = (outcome: Outcome): void => {
        if (settled) return;
        settled = true;
        detach();
        resolve(outcome);
      };
      work.then(
        (value) => finish({ kind: 'ok', value }),
        (error) => finish({ kind: 'error', error: String(error) }),
      );
      if (timeoutMs > 0) timer = setTimeout(() => finish({ kind: 'timeout' }), timeoutMs);
      if (signal) signal.addEventListener('abort', onAbort);
    });
  }

  private newTraceId(): string {
    this.traceSeq += 1;
    return `trace-${this.traceSeq.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private traceSeq = 0;
}
