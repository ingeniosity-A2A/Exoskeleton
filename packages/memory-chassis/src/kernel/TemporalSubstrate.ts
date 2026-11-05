/**
 * HolographicTemporalEngine — frame-synchronized transition injection.
 * Persistence completes before the runtime transition begins. This prevents
 * the live state from advancing when the durable ledger write fails.
 */
import gsap from 'gsap';
import {
  AvaCognitiveState,
  TweenAtom,
  AtomicTweenRow,
  atomToRows,
} from '../types/CognitiveState';

const MOMENTUM_DIMS = ['valence', 'urgency'] as const;

export interface EngineOptions {
  moleculeId: string;
  generation: number;
  persist?: (row: AtomicTweenRow) => Promise<void>;
}

export class HolographicTemporalEngine {
  private mind: AvaCognitiveState;
  private lastState: AvaCognitiveState;
  private lastTimestamp: number;

  constructor(initialState: AvaCognitiveState, private opts: EngineOptions) {
    this.mind = { ...initialState };
    this.lastState = { ...initialState };
    this.lastTimestamp = gsap.ticker.time;
  }

  /** Persist every numeric property before allowing GSAP to mutate live state. */
  public async injectTransitionLaw(atom: TweenAtom): Promise<gsap.core.Tween> {
    const rows = atomToRows(atom, this.opts.moleculeId, this.mind, this.opts.generation);
    if (this.opts.persist) {
      for (const row of rows) await this.opts.persist(row);
    }

    this.lastTimestamp = gsap.ticker.time;
    this.lastState = { ...this.mind };

    return gsap.to(this.mind, {
      ...atom.targetState,
      duration: atom.durationMs / 1000,
      ease: atom.easingWavefunction,
      overwrite: 'auto',
      onUpdate: () => {
        const now = gsap.ticker.time;
        const dt = now - this.lastTimestamp;
        if (dt > 0) {
          let squaredDelta = 0;
          for (const dimension of MOMENTUM_DIMS) {
            const delta = this.mind[dimension] - this.lastState[dimension];
            squaredDelta += delta * delta;
          }
          this.mind.momentum = Math.sqrt(squaredDelta) / dt;
        }
        this.lastTimestamp = now;
        this.lastState = { ...this.mind };
      },
      onComplete: () => { this.mind.momentum = 0; },
    });
  }

  public snapshot(): Readonly<AvaCognitiveState> {
    return { ...this.mind };
  }
}
