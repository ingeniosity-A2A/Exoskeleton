/**
 * Capability surface for Aperture / Tailscale identity.
 * No shared API keys. Grants are evaluated externally.
 */

export type LibrarianCapability =
  | "intake.write"
  | "curator.create"
  | "curator.merge"
  | "curator.delete"
  | "chassis.read"
  | "chassis.materialize";

export interface GrantContext {
  /** Subject identity (Tailscale login / node identity) */
  subject: string;
  /** Capabilities already granted for this session */
  capabilities: Set<LibrarianCapability>;
}

export function hasCapability(
  ctx: GrantContext,
  capability: LibrarianCapability
): boolean {
  return ctx.capabilities.has(capability);
}

export function requireCapability(
  ctx: GrantContext,
  capability: LibrarianCapability
): void {
  if (!hasCapability(ctx, capability)) {
    throw new Error(`capability denied: ${capability} for ${ctx.subject}`);
  }
}
