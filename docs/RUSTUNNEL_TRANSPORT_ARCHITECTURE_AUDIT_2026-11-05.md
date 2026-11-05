# Rustunnel Transport Architecture Audit

**Recorded:** 2026-11-05  
**Repository:** `ingeniosity-A2A/Exoskeleton`  
**Status:** Documentation-derived architecture assessment; integration and deployment are not yet verified  
**Scope:** Additive transport-plane contract for the Exoskeleton whole-system memory and execution architecture

## 1. Finding

Rustunnel was missing from the transport analysis. It is a Rust-based, self-hostable tunneling system that exposes local HTTP and TCP services through encrypted WebSocket connections. Its documented architecture also includes P2P connections using UDP hole punching and QUIC, with relay fallback, plus a separate UDP forwarding capability.

Rustunnel belongs in the **network transport / service exposure plane**. It is not a memory store, event ledger, replication authority, cognitive authority, or database protocol.

Official documentation:
- Overview: https://www.rustunnel.com/docs
- Architecture: https://www.rustunnel.com/docs/guides/architecture
- Self-hosting: https://www.rustunnel.com/docs/guides/self-hosting
- P2P tunnels: https://www.rustunnel.com/docs/reference/p2p-tunnels

## 2. Placement in the system

Rustunnel is a cross-cutting transport capability beneath Exoskeleton's application-level service contracts. It is not a new truth layer and must not change the L0-L6 authority model.

| Existing boundary | Rustunnel relationship |
|---|---|
| L0 Source Truth / DuckDB | May provide network reachability to a deliberately authorized service endpoint; it does not store or define Source Truth |
| L1 Trust Truth | Adds its own tunnel bearer-token/shared-secret controls; these do not replace Tailscale identity, Grants, or application authorization |
| L2 Event/replication | Can carry an application transport connection where explicitly selected; it does not provide durable outbox semantics, ordering, idempotency, acknowledgements, or replay |
| L3 Temporal Truth | No authority; may transport an authorized API connection |
| L4 Retrieval projections | No authority; may transport an authorized query/service connection |
| L5 REV.IKE | May expose a narrowly scoped agent/service endpoint; cannot grant REV.IKE write or execution authority |
| L5A Proposals | May carry proposal API traffic; proposal acceptance remains AVA-007-only |
| L6 Action Truth | May carry an authorized command channel; authorization and execution policy remain with AVA-007 and the receiving service |

**Transport separation:** Tailscale remains the private device-to-device identity/network overlay. Rustunnel is an independently authenticated tunnel and ingress/egress transport option. Neither should be silently substituted for the other. A Rustunnel bearer token is not a Tailscale identity or an Exoskeleton Grant.

## 3. Documented Rustunnel mechanisms

### Standard HTTP/TCP tunnels

The architecture describes:
- A control-plane WebSocket for authentication, tunnel registration, and heartbeat.
- A separate data-plane WebSocket carrying yamux-multiplexed binary streams.
- HTTP/HTTPS edge routing by hostname and TCP edge routing by allocated port.
- Tokio asynchronous tasks, per-connection proxy tasks, and bidirectional stream copying.
- TLS via rustls, with static PEM or ACME certificate management.
- Bearer-token validation against PostgreSQL.
- Per-IP and per-tunnel rate limiting on the HTTP edge.
- Dashboard/API, Prometheus metrics, structured logs, and append-only audit events.

The documented data path uses `copy_bidirectional` between sockets and yamux streams. This is a transport proxy, **not evidence of zero-copy**. Its buffer behavior and copy/allocation cost must be measured in the actual build.

### P2P and QUIC

Rustunnel documents two P2P modes:
- **Relayed:** persistent client WebSocket sessions and yamux streams are bridged by the server.
- **Direct:** signaling is performed through the server, then peers attempt UDP hole punching and establish an encrypted QUIC session.
- **Fallback:** if direct mode is not viable (for example, restrictive or symmetric NAT), traffic falls back to the relay path.

Direct mode can reduce relay bandwidth and path latency, but it is conditional on NAT/firewall compatibility. It must not be assumed available on a particular carrier, hotspot, Android device, or network without a live connectivity test.

### UDP forwarding

Rustunnel's documentation index also lists a dedicated UDP tunnel feature for UDP forwarding. Treat this as a separate capability from its HTTP/TCP WebSocket-yamux tunnel and from P2P QUIC. Verify the exact implementation, security model, limits, and current release behavior before assigning it to any production workload.

## 4. Candidate uses in this environment

Evaluate Rustunnel for:
1. Controlled webhook ingress to a local service that cannot accept inbound connections directly.
2. Temporary, authenticated exposure of a development or diagnostic endpoint.
3. TCP service reachability between constrained edge devices and a VPS-hosted service.
4. Agent-managed tunnel lifecycle through its documented MCP integration, subject to explicit tool authorization and narrow scopes.
5. P2P/QUIC data paths for latency-sensitive edge-to-edge traffic when direct connectivity is actually established.
6. UDP forwarding experiments where the application protocol genuinely requires UDP.

These are candidate uses, not a declaration that any of them is deployed or accepted.

## 5. Coexistence with Tailscale, DuckDB Quack, and the application outbox

| Component | Primary responsibility | Do not conflate with |
|---|---|---|
| Tailscale | Private overlay connectivity and device identity / Grants context | Public tunnel ingress or application-level authorization by itself |
| Rustunnel | Authenticated service tunneling, proxying, optional P2P/QUIC and UDP forwarding | Durable memory, database consistency, or Source Truth |
| DuckDB Quack | DuckDB client/server database protocol | General-purpose service tunnel or event bus |
| Exoskeleton application outbox/apply | Durable event sequencing, idempotent apply, acknowledgement, watermarks, replay and offline recovery | A network tunnel or DuckDB's Quack protocol |

Do not put Rustunnel in front of every connection by default. Prefer the shortest authorized path:
- Tailscale for private device/service communication when the tailnet path is sufficient.
- Rustunnel when inbound reachability, controlled external exposure, or its P2P/UDP behavior provides a demonstrated capability.
- DuckDB Quack only for DuckDB remote database operations.
- The application outbox remains responsible for durable replication semantics.

A tunnel can transport an outbox connection; it cannot make an unreliable transport durable. A tunnel can make a database endpoint reachable; it cannot authorize the caller at the database/application layer.

## 6. Security and deployment gates

Before any deployment or production use:
1. Self-host on infrastructure controlled by the project; verify the exact source revision, license obligations (the self-hosting documentation identifies the project as AGPL), build provenance, release/version, and supply-chain dependencies.
2. Keep admin/dashboard, metrics, PostgreSQL, and request-inspector surfaces private; expose only explicitly intended edge listeners.
3. Use unique high-entropy tokens, rotate/revoke credentials, and scope each tunnel to one service and purpose.
4. Keep TLS verification enabled. Never use the documented `--insecure` certificate-verification bypass in production.
5. Bind local targets to the intended interface and service. Never expose a broad localhost/admin surface merely because it is convenient.
6. Require application authentication and authorization at the destination. Tunnel authentication is an additional perimeter, not a replacement.
7. Validate rate limits, connection quotas, tunnel ownership, audit-log retention, request-body capture, and sensitive-data handling.
8. Test reconnect, heartbeat timeout, server restart, token revocation, stale tunnel cleanup, concurrent streams, backpressure, and partial network failure.
9. For P2P, record whether the session was direct or relayed; test symmetric NAT, carrier-grade NAT, hotspot restrictions, UDP blocking, and fallback behavior.
10. For UDP forwarding, separately validate datagram loss, ordering, MTU/fragmentation, congestion, amplification exposure, and source validation.
11. Do not expose DuckDB, PostgreSQL, shell, or privileged device-control endpoints without independent authorization and least-privilege controls.
12. Do not assume Tailscale ACLs or Grants automatically govern Rustunnel traffic. Explicitly enforce the destination service's authorization policy.

## 7. Whole-system performance and zero-copy implications

Add Rustunnel as a transport candidate in the end-to-end benchmark, not as an assumed optimization.

Measure the same payload and workload over:
- direct local loopback;
- direct Tailscale path;
- Rustunnel standard WebSocket + yamux relay;
- Rustunnel P2P direct QUIC, when established;
- Rustunnel P2P relay fallback;
- Rustunnel UDP forwarding, only for a UDP-native workload.

Capture:
- connection setup and reconnection time;
- path classification (direct/relay) and route;
- RTT, p50/p95/p99 latency, jitter, throughput, loss and retransmission;
- CPU, memory, task count, socket buffers and server bandwidth;
- allocations, buffering, serialization, and every copy at each proxy boundary;
- concurrent stream scaling and backpressure behavior;
- auth failures, revocation behavior, and audit evidence;
- full application transaction latency and recovery—not just tunnel throughput.

The standard architecture explicitly uses bidirectional copy operations and a WebSocket-to-yamux adapter. Do not label that path zero-copy. Direct QUIC may remove the central relay hop, but does not establish zero-copy at the endpoint, runtime, database, or FFI boundaries.

## 8. Required integration status

| Item | Status |
|---|---|
| Rustunnel documented capabilities reviewed | Specified |
| Correct architecture placement defined | Specified |
| Tailscale / DuckDB Quack / application outbox boundaries defined | Specified |
| Rustunnel installed on project VPS or edge devices | Not verified |
| Tunnel authentication and destination authorization tested | Not verified |
| P2P direct and relay fallback tested on S26/S25/VPS | Not verified |
| UDP path tested | Not verified |
| Rustunnel integrated into Exoskeleton code | Not verified |
| End-to-end benchmark completed | Not verified |
| Production deployment / acceptance | Not verified |

No code, runtime, deployment, or benchmark completion is implied by this document.

## 9. Governing rule

Rustunnel is an optional, independently authenticated transport capability in the Exoskeleton network plane. Select it only where measured capability justifies the extra hop and operational surface. Preserve Tailscale identity, AVA-007 authority, Exoskeleton durability, and all existing Manifesto invariants.

**The objective remains whole-system correctness, security, durability, observability, and measured performance—not tunnel throughput in isolation.**
