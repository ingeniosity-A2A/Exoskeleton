import gsap from 'gsap';
import {
  AvaCognitiveState,
  TweenAtom,
  AtomicTweenRow,
  atomToRow,
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

  public injectTransitionLaw(atom: TweenAtom): gsap.core.Tween {
    this.lastTimestamp = gsap.ticker.time;
    this.lastState = { ...this.mind };

    const row = atomToRow(atom, this.opts.moleculeId, this.mind, this.opts.generation);
    void this.opts.persist?.(row);

    return gsap.to(this.mind, {
      ...atom.targetState,
      duration: atom.durationMs / 1000,
      ease: atom.easingWavefunction,
      overwrite: 'auto',
      onUpdate: () => {
        const now = gsap.ticker.time;
        const dt = now - this.lastTimestamp;
        if (dt > 0) {
          let sq = 0;
          for (const d of MOMENTUM_DIMS) {
            const dd = this.mind[d] - this.lastState[d];
            sq += dd * dd;
          }
          this.mind.momentum = Math.sqrt(sq) / dt;
        }
        this.lastTimestamp = now;
        this.lastState = { ...this.mind };
      },
      onComplete: () => {
        this.mind.momentum = 0;
      },
    });
  }

  public snapshot(): Readonly<AvaCognitiveState> {
    return this.mind;
  }
}
