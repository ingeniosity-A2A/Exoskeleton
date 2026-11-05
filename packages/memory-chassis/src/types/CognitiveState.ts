/**
 * Real-time cognitive state and canonical temporal ledger mapping.
 * The SQL ledger stores numeric properties only; categorical routing changes
 * remain runtime state until a typed categorical event schema is introduced.
 */
export interface AvaCognitiveState {
  valence: number;
  urgency: number;
  momentum: number;
  routingTarget: 'standard' | 'de-escalation' | 'drone-radar';
}

export interface TweenAtom {
  targetState: Partial<AvaCognitiveState>;
  easingWavefunction: string;
  cognitiveWeight: number;
  startTimeMs: number;
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

/** One row per numeric property; no silent loss of multi-property transitions. */
export function atomToRows(
  atom: TweenAtom,
  moleculeId: string,
  fromState: AvaCognitiveState,
  generation: number,
): AtomicTweenRow[] {
  if (!moleculeId.trim()) throw new Error('moleculeId is required');
  if (!Number.isSafeInteger(generation) || generation < 0) {
    throw new Error('generation must be a non-negative safe integer');
  }
  if (!Number.isFinite(atom.startTimeMs) || atom.startTimeMs < 0
      || !Number.isFinite(atom.durationMs) || atom.durationMs <= 0) {
    throw new Error('transition time and duration must be finite; duration must be positive');
  }

  const entries = Object.entries(atom.targetState);
  if (entries.length === 0) throw new Error('transition has no target properties');

  return entries.map(([property, value]) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`ledger property ${property} must be numeric and finite`);
    }
    const start = fromState[property as keyof AvaCognitiveState];
    if (typeof start !== 'number' || !Number.isFinite(start)) {
      throw new Error(`ledger start value for ${property} must be numeric and finite`);
    }
    return {
      tween_id: crypto.randomUUID(),
      molecule_id: moleculeId,
      target_property: property,
      start_value: start,
      end_value: value,
      start_time_ms: atom.startTimeMs,
      duration_ms: atom.durationMs,
      easing_code_id: EASING_CODEBOOK[atom.easingWavefunction] ?? 0,
      orchestrator_generation_id: generation,
    };
  });
}
