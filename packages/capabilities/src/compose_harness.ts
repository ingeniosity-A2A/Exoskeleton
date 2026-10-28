/**
 * Reference: collapse a multi-step harness into one capability
 * (Appendix B — Grok Build pattern).
 *
 * Grok Build is a coding harness with subagents/MCP/plugins.
 * Section 6.5 of the main paper: wrap that class of system as ONE named
 * capability. This file is the same pattern for any harness — not a
 * template for the substrate layer.
 */

import type {
  CapabilityHandler,
  CapabilityObservation,
  CapabilityRequest,
} from './types';

export interface HarnessStep {
  name: string;
  run: (ctx: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

/**
 * Compose ordered steps into a single capability name.
 * Model only sees capability name + final observation.
 */
export function composeHarnessCapability(
  name: string,
  description: string,
  steps: HarnessStep[],
): CapabilityHandler {
  return {
    name,
    kind: 'composed',
    description,
    async invoke(req: CapabilityRequest): Promise<CapabilityObservation> {
      const t0 = performance.now();
      let ctx: Record<string, unknown> = { ...req.input };
      try {
        for (const step of steps) {
          const out = await step.run(ctx);
          ctx = { ...ctx, ...out, _lastStep: step.name };
        }
        const { _lastStep: _, ...data } = ctx;
        return {
          ok: true,
          capability: name,
          data,
          latencyMs: performance.now() - t0,
        };
      } catch (e) {
        return {
          ok: false,
          capability: name,
          data: {},
          error: String(e),
          latencyMs: performance.now() - t0,
        };
      }
    },
  };
}

/**
 * Example: coding-style composed capability (Grok Build analogue).
 * Steps are internal; model calls `code.resolve` only.
 */
export const codeResolveExample = composeHarnessCapability(
  'code.resolve',
  'Resolve a coding task end-to-end; internal steps hidden.',
  [
    {
      name: 'plan',
      async run(ctx) {
        return { plan: `plan(${String(ctx.task ?? '')})` };
      },
    },
    {
      name: 'edit',
      async run(ctx) {
        return { diff: `// edit for: ${String(ctx.plan ?? '')}` };
      },
    },
    {
      name: 'verify',
      async run(ctx) {
        return { verified: true, summary: String(ctx.diff ?? '').slice(0, 80) };
      },
    },
  ],
);
