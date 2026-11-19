/**
 * Capability layer — manifesto §6 rule:
 * Model calls a capability by name and receives a uniform observation.
 * It never learns whether the implementation was a function call,
 * a coding harness, or a physical world model.
 */

export type CapabilityKind =
  | 'tool'
  | 'harness'
  | 'sensory'
  | 'physical'
  | 'composed';

export interface CapabilityObservation {
  ok: boolean;
  capability: string;
  /** Opaque payload the model may read; never exposes backend identity */
  data: Record<string, unknown>;
  error?: string;
  latencyMs: number;
}

/**
 * Structural subset of AbortSignal. The package pins no DOM/Node types, so the
 * contract is expressed as the shape a provider may rely on.
 */
export interface CapabilitySignal {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}

export interface CapabilityRequest {
  capability: string;
  input: Record<string, unknown>;
  /** Orchestrator generation for ledger correlation */
  generationId?: number;
  /** Correlates provider work with lifecycle telemetry */
  traceId?: string;
  /**
   * Aborted by the lifecycle on timeout or caller cancellation. A provider that
   * honours it stops its own work; one that ignores it is reported as undrained
   * rather than assumed stopped.
   */
  signal?: CapabilitySignal;
}

export interface CapabilityHandler {
  name: string;
  kind: CapabilityKind;
  description: string;
  invoke(req: CapabilityRequest): Promise<CapabilityObservation>;
}

export interface CapabilityManifest {
  name: string;
  kind: CapabilityKind;
  description: string;
  /** Optional implementation backends — never exposed to the model */
  backends?: string[];
}
