/**
 * REV.IKE Librarian — headless entry point.
 *
 * Identity-aware, operates in place, gateway-ready.
 * No shared API keys. No cognitive reasoning.
 */

export const LIBRARIAN_NAME = "REV.IKE";
export const LIBRARIAN_ROLE = "headless-librarian";

export interface LibrarianContext {
  /** Tailscale / Aperture identity subject when available */
  identity?: string;
  /** Workspace root the Librarian is allowed to curate */
  workspaceRoot: string;
}

export function createLibrarianContext(
  workspaceRoot: string,
  identity?: string
): LibrarianContext {
  return { workspaceRoot, identity };
}

export function describe(): string {
  return [
    "REV.IKE — Headless Librarian",
    "Owns intake and curation of the long-term memory chassis.",
    "Operates in place under identity grants.",
  ].join(" ");
}
