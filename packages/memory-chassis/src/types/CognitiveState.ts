/**
 * Real-time state manifold — discrepancy-aligned.
 * Momentum is a rate variable Mc = |dS|/dt, not a binary activity flag.
 */

export interface AvaCognitiveState {
  /** Emotional valence: -1.0 (frustrated) .. 1.0 (delighted) */
  valence: number;
  /** Urgency: 0.0 (idle) .. 1.0 (critical) */
  urgency: number;
  /** Cognitive momentum: true velocity of state change (rate), decays to 0 at rest */
  momentum: number;
  /** Autonomous core routing target */
  routingTarget: 'standard' | 'de-escalation' | 'drone-radar';
}

export interface TweenAtom {
  targetState: Partial<AvaCognitiveState>;
  /** Easing wavefunction name (e.g. 'back.out') — not a direction command */
  easingWavefunction: string;
  cognitiveWeight: number;
  /** Absolute temporal offset from timeline anchor (ms) */
  startTimeMs: number;
  /** Transition duration (ms); back.out target constraint often 800ms */
  durationMs: number;
}

export const EASING_CODEBOOK: Record<string, number> = {
  linear: 0,
  'back.out': 1,
  'cahnHilliard.spinodal': 2,
  'cahnHilliard.spinodal.soft': 3,
  'cahnHilliard.spinodal.hard': 4,
  'power2.out': 5,
  'power1.in': 6,
};

export interface AtomicTweenRow {
  tween_id: string;
  molecule_id: string;
  target_property: string;
  start_value: number;
  end_value: number;
  start_time_ms: number;
  duration_ms: number;
  easing_code_id: number;
  orchestrator_generation_id: number;
}

/** Canonical TweenAtom → ledger row. Indexes on temporal axis (start_time_ms). */
export function atomToRow(
  atom: TweenAtom,
  moleculeId: string,
  fromState: AvaCognitiveState,
  generation: number,
): AtomicTweenRow {
  const prop = Object.keys(atom.targetState)[0] as keyof AvaCognitiveState;
  return {
    tween_id: crypto.randomUUID(),
    molecule_id: moleculeId,
    target_property: prop,
    start_value: (fromState[prop] as number) ?? 0,
    end_value: (atom.targetState as Record<string, number>)[prop] as number,
    start_time_ms: atom.startTimeMs,
    duration_ms: atom.durationMs,
    easing_code_id: EASING_CODEBOOK[atom.easingWavefunction] ?? 0,
    orchestrator_generation_id: generation,
  };
}
