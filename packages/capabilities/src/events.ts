/**
 * Exoskeleton lifecycle telemetry — versioned execution events.
 *
 * Every execution carries a `traceId` and a `generationId`. Events are emitted
 * in monotonic `seq` order per trace and are append-only. This module defines
 * the schema and an in-memory sink only: no external exporter is claimed or
 * implemented, because none is provisioned.
 */

export const LIFECYCLE_EVENT_SCHEMA = 'exoskeleton.lifecycle.event/1.0' as const;

export type LifecyclePhase =
  | 'validate'
  | 'resolve'
  | 'allocate'
  | 'execute'
  | 'observe'
  | 'validate_outcome'
  | 'interrupt'
  | 'release'
  | 'complete';

export type LifecycleStatus = 'start' | 'ok' | 'error' | 'timeout' | 'cancelled';

export type LifecycleErrorCode =
  | 'INVALID_INPUT'
  | 'CONTRACT_MISSING'
  | 'AUTHORIZATION_DENIED'
  | 'UNKNOWN_CAPABILITY'
  | 'ALLOCATION_FAILED'
  | 'HANDLER_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'INVALID_OUTPUT'
  | 'CLEANUP_ERROR';

export interface LifecycleEvent {
  schema: typeof LIFECYCLE_EVENT_SCHEMA;
  /** Stable `traceId:seq` identifier for deduplication downstream. */
  eventId: string;
  traceId: string;
  generationId: number;
  capability: string;
  /** Monotonic per trace, starting at 1. */
  seq: number;
  phase: LifecyclePhase;
  status: LifecycleStatus;
  /** Milliseconds since the start of the execution (not wall clock). */
  atMs: number;
  durationMs: number | null;
  errorCode: LifecycleErrorCode | null;
  detail: Record<string, unknown>;
}

export interface EventSink {
  emit(event: LifecycleEvent): void;
}

/**
 * Discards every event. This is the "telemetry disabled" baseline used to
 * measure what emitting events costs, not a placeholder exporter.
 */
export class NullEventSink implements EventSink {
  emit(_event: LifecycleEvent): void {
    /* intentionally empty */
  }
}

/** Bounded in-memory ring buffer. Never grows without limit. */
export class MemoryEventSink implements EventSink {
  readonly events: LifecycleEvent[] = [];
  private capacity: number;

  constructor(capacity = 2048) {
    this.capacity = capacity;
  }

  emit(event: LifecycleEvent): void {
    this.events.push(event);
    if (this.events.length > this.capacity) this.events.shift();
  }

  clear(): void {
    this.events.length = 0;
  }
}

/** Events for one trace, in emission order. */
export function traceEvents(sink: MemoryEventSink, traceId: string): LifecycleEvent[] {
  return sink.events.filter((event) => event.traceId === traceId);
}
