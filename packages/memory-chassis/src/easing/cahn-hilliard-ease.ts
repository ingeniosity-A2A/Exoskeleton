import gsap from 'gsap';

const cache = new Map<string, (progress: number) => number>();

export function spinodalEase(gain = 4.2): (progress: number) => number {
  if (!Number.isFinite(gain) || gain <= 0) {
    throw new Error('spinodal gain must be a positive finite number');
  }
  const key = gain.toFixed(6);
  const existing = cache.get(key);
  if (existing) return existing;

  const low = 1 / (1 + Math.exp(gain));
  const high = 1 / (1 + Math.exp(-gain));
  const ease = (progress: number): number => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    const raw = 1 / (1 + Math.exp(-gain * (2 * progress - 1)));
    return (raw - low) / (high - low);
  };
  cache.set(key, ease);
  return ease;
}

export function registerCahnHilliardEases(): void {
  gsap.registerEase('cahnHilliard.spinodal', spinodalEase(4.2));
  gsap.registerEase('cahnHilliard.spinodal.soft', spinodalEase(2));
  gsap.registerEase('cahnHilliard.spinodal.hard', spinodalEase(7));
}

// Registration is explicit so importing a library module has no global side effect.
