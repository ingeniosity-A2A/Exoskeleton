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

/** Canonical TweenAtom -> ledger row mapper. */
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
