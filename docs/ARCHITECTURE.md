# Architecture

## Overview

The Exoskeleton is a three-plane autonomous agent framework running
on Kiri (a lightweight Docker-compatible container runtime). Each
plane is a logical grouping of services connected via Kiri's
service-name DNS and bridge networks.

## The Three Planes

### Plane 1: Dependency Plane

Indexes repository dependencies into DuckDB 2.0 using the Headless
GitHub CLI Agent.

```
┌─────────────────────┐     ┌─────────────────────┐
│ GitHub CLI Agent    │────►│ DuckDB 2.0 Index    │
│ (autonomous loop)   │     │ (Green Band)        │
│ port 9090           │     │ port 9999           │
└─────────────────────┘     └─────────────────────┘
         │                           │
         ▼                           ▼
   ┌──────────┐              ┌──────────────┐
   │ INDEX.md │              │ Long-Term    │
   │ (render) │              │ Lake         │
   └──────────┘              └──────────────┘
```

**Services:**
- `agent` — Headless GitHub CLI Agent (Python, autonomous, restart: unless-stopped)
- `duckdb` — DuckDB 2.0 database server (Long-Term Lake)
- `dashboard` — Nginx serving INDEX.md

### Plane 2: Sensory Plane

Ingests payloads (images, telemetry, network events) at Tier 1
Sensory Edge. Writes to Short-Term Hot State DuckDB with full
epistemic provenance and network metrics.

```
┌─────────────────────┐     ┌─────────────────────┐
│ The_Beeper          │────►│ beeper_local.db     │
│ (Tier 1 Sensory)    │     │ (Orange Band)       │
│ port 8080           │     │ (Short-Term)        │
└─────────────────────┘     └─────────────────────┘
         │                           │
         │ upload / telemetry        │ replicate + zstd
         ▼                           ▼
   ┌──────────────┐          ┌─────────────────┐
   │ network_     │          │ beeper_replica  │
   │ telemetry    │          │ .db             │
   └──────────────┘          └─────────────────┘
```

**Services:**
- `beeper-core` — Flask ingestion + DuckDB writer + health endpoint
- `beeper-replicator` — Auto-push replica to OCI Core Anchor via rustunnel

### Plane 3: Transport Plane

Couples models via KICE (Kinetic Intelligence Coupling Engine),
enforces epistemic gates, and syncs Orange Band → Green Band.

```
┌─────────────────────┐     ┌─────────────────────┐
│ KICE Engine         │────►│ Sovereign Authority │
│ (4-model coupling)  │     │ (Ava-007)           │
└─────────────────────┘     └─────────────────────┘
         │                           │
         ▼                           ▼
   ┌──────────────┐          ┌─────────────────┐
   │ sync-bridge  │          │ audit ledger    │
   │ (epistemic   │          │ (cryptographic  │
   │  gate)       │          │  hash chain)    │
   └──────────────┘          └─────────────────┘
```

**Services:**
- `mesh-controller` — rustunnel orchestrator + health monitor
- `sync-bridge` — DuckDB Short-Term → Long-Term Lake with epistemic gate

## Networking

Kiri Compose creates two bridge networks:

- `exoskeleton` — main plane (agent, duckdb, dashboard, beeper, mesh, sync)
- `beeper_transport` — transport plane (beeper, replicator, mesh)

Service DNS (inside the network):
- `agent:9090`, `duckdb:9999`, `beeper-core:8080`, `mesh-controller:8080`

Host DNS (Kiri's .kiri.localhost routing):
- `http://sandbox.exoskeleton.kiri.localhost`
- `http://agent.exoskeleton.kiri.localhost`
- `http://beeper.exoskeleton.kiri.localhost`
- `http://dashboard.exoskeleton.kiri.localhost`

## Data Flow

```
1. Payload arrives at The_Beeper (/upload)
   → SHA-256 checksum computed
   → Network metrics captured (bytes, latency, connection type)
   → Epistemic state: OBSERVED
   → Written to beeper_local.db (Orange Band)

2. Sync bridge runs every 300s
   → Reads sensory_logs from beeper_local.db
   → Applies epistemic gate:
       OBSERVED  → synced to Green Band
       DERIVED   → synced with provenance
       INFERRED  → BLOCKED
       HYPOTHESIZED → BLOCKED
   → Writes to exoskeleton_lake.db (Long-Term Lake)

3. GitHub Agent runs every 300s
   → Queries gh api for dependency versions
   → Updates dependency_index.db
   → Renders INDEX.md

4. KICE evaluates model proposals
   → Calibrates confidence
   → Computes pairwise disagreement D(A,B)
   → Aggregates C_final = min(C_weighted, C_weakest)
   → Checks constraint violations (CV-001–CV-010)
   → Decision: PROCEED / SOVEREIGN_REVIEW / HALT

5. Sovereign Authority (Ava-007) decides
   → Reads KICE decision + evidence
   → APPROVE / REJECT / DEFER / OVERRIDE_KICE
   → Logged to cryptographic audit ledger
```

## Compute Budget (99%/1% Invariant)

| Tier | Budget | Components |
|---|---|---|
| Tier 1 (Sensory Edge) | ≤ 1% | Token delta streaming, lock-free ring buffer |
| Tier 2 (Subconscious) | ≤ 50% | KICE model inference, disagreement, confidence |
| Tier 3 (Recursive Core) | ≥ 49% | Sovereign decision, verification, teach-back |

The 99%/1% ratio is a **Stanza IV invariant** from the Ava-007
Manifesto. It is NOT waivable.

## Container Runtime

| Feature | Kiri provides |
|---|---|
| Container start | ~2.5ms (80x faster than Docker Desktop) |
| Compose | Full `docker compose` compatibility |
| DNS | Service-name resolution on project networks |
| Host routing | `http://<service>.<project>.kiri.localhost` |
| Healthchecks | Native compose healthcheck support |
| Volumes | Named volumes survive `compose down` |
