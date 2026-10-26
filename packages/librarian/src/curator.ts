/**
 * In-place curation tools for the Librarian.
 * Anticipatory workspace operations: create / merge / delete / stop.
 */

export type CuratorAction =
  | { type: "create"; path: string; content: string; sources: string[] }
  | { type: "merge"; paths: string[]; target: string }
  | { type: "delete"; path: string }
  | { type: "stop" };

export interface CuratorResult {
  ok: boolean;
  action: CuratorAction["type"];
  message?: string;
}

/**
 * Apply a single curation action against the workspace root.
 * Operates in place. Does not copy corpora elsewhere.
 */
export async function applyCuratorAction(
  workspaceRoot: string,
  action: CuratorAction
): Promise<CuratorResult> {
  // Implementation lands after identity and grants are wired.
  // This surface is intentionally narrow and grant-controlled.
  switch (action.type) {
    case "create":
      return { ok: false, action: "create", message: "not yet implemented" };
    case "merge":
      return { ok: false, action: "merge", message: "not yet implemented" };
    case "delete":
      return { ok: false, action: "delete", message: "not yet implemented" };
    case "stop":
      return { ok: true, action: "stop" };
  }
}
