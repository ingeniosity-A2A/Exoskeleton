/**
 * Identity-aware grants for REV.IKE serve / curate paths.
 * Tailscale / Aperture subject is injected by the host; this module only checks.
 */

export type Grant = 'read' | 'curate' | 'materialize' | 'admin';

export type Subject = {
  did: string;
  /** Stable node / tailnet identity string when available */
  nodeId?: string;
  grants: Grant[];
};

const DEFAULT_DENY: Subject = { did: 'anonymous', grants: [] };

export function subjectFromHeaders(
  headers: Record<string, string | undefined>,
  grantMap: Record<string, Grant[]>,
): Subject {
  const did =
    headers['x-ava-did'] ??
    headers['x-tailscale-user'] ??
    headers['x-aperture-subject'] ??
    DEFAULT_DENY.did;
  const nodeId = headers['x-tailscale-node'] ?? headers['x-avn'];
  const grants = grantMap[did] ?? grantMap['*'] ?? [];
  return { did, nodeId, grants };
}

export function assertGrant(subject: Subject, need: Grant): void {
  if (subject.grants.includes('admin') || subject.grants.includes(need)) return;
  throw new Error(`grant denied: ${subject.did} lacks ${need}`);
}
