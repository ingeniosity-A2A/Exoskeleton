/**
 * Minimal ambient runtime declarations.
 *
 * The workspace currently pins only `typescript` (no @types/node) and adding a
 * devDependency here would force a pnpm lockfile change. These declarations
 * describe exactly the Node/Web globals this package uses and nothing more.
 */

declare function setTimeout(handler: () => void, timeout?: number): unknown;
declare function clearTimeout(handle: unknown): void;

declare const performance: { now(): number };
