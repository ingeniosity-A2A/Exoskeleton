import type {
  CapabilityHandler,
  CapabilityManifest,
  CapabilityObservation,
  CapabilityRequest,
} from './types';

/**
 * In-process capability registry.
 * This is NOT a pnpm catalog. Catalogs pin dependency versions.
 * This registry pins named capabilities the model may call.
 */
export class CapabilityRegistry {
  private handlers = new Map<string, CapabilityHandler>();

  register(handler: CapabilityHandler): void {
    if (this.handlers.has(handler.name)) {
      throw new Error(`capability already registered: ${handler.name}`);
    }
    this.handlers.set(handler.name, handler);
  }

  list(): CapabilityManifest[] {
    return [...this.handlers.values()].map((h) => ({
      name: h.name,
      kind: h.kind,
      description: h.description,
    }));
  }

  async invoke(req: CapabilityRequest): Promise<CapabilityObservation> {
    const t0 = performance.now();
    const h = this.handlers.get(req.capability);
    if (!h) {
      return {
        ok: false,
        capability: req.capability,
        data: {},
        error: `unknown capability: ${req.capability}`,
        latencyMs: performance.now() - t0,
      };
    }
    try {
      const obs = await h.invoke(req);
      return { ...obs, latencyMs: obs.latencyMs || performance.now() - t0 };
    } catch (e) {
      return {
        ok: false,
        capability: req.capability,
        data: {},
        error: String(e),
        latencyMs: performance.now() - t0,
      };
    }
  }
}

export const globalCapabilityRegistry = new CapabilityRegistry();
