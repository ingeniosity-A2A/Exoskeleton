# The_Beeper — Sensory Capability Node

**Tier 1 Sensory Edge.** Ingests payloads (images, telemetry,
network events) with full epistemic provenance and network metrics.
Replicates to backup DuckDB. Auto-pushes to OCI Core Anchor via
rustunnel.

## Architecture

```
┌──────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Flask API   │───►│ beeper_local.db │───►│ beeper_replica  │
│  port 8080   │    │ (Orange Band)   │    │ .db             │
└──────────────┘    └─────────────────┘    └────────┬────────┘
       │                                            │
       │ upload/telemetry                           │ rsync/zstd
       ▼                                            ▼
 ┌──────────────┐                          ┌─────────────────┐
 │ network_     │                          │ OCI Core Anchor │
 │ telemetry    │                          │ 100.129.159.107 │
 └──────────────┘                          └─────────────────┘
```

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/status` | Full node status |
| `POST` | `/upload` | Ingest file payload |
| `POST` | `/telemetry` | Ingest network telemetry |
| `GET` | `/query/network` | Network health dashboard |
| `GET` | `/query/epistemic` | Epistemic state breakdown |
| `GET` | `/query/replication` | Replication health |

## Epistemic Provenance

Every event carries:

- `epistemic_state`: OBSERVED / DERIVED / INFERRED / HYPOTHESIZED
- `evidence_source`: Where the evidence came from
- `content_hash`: BLAKE2b-256 integrity hash
- `prev_hash` → `event_hash`: Cryptographic audit chain

## Network Metrics (Schema)

| Column | Type | Constraint |
|---|---|---|
| `bytes_in` / `bytes_out` | BIGINT | ≥ 0 |
| `latency_ms` | DOUBLE | ≥ 0 |
| `packet_loss_pct` | DOUBLE | 0–100 |
| `bandwidth_mbps` | DOUBLE | ≥ 0 |
| `connection_type` | VARCHAR | enum |
| `file_checksum` | VARCHAR | ≥ 32 chars if present |

## Make Targets

```bash
make sandbox-up       # Deploy container (Kiri Compose)
make sandbox-down     # Tear down container
make start            # Start node + rustunnel + auto-replicate
make stop             # Stop everything (runs replicate-db first)
make replicate-db     # Snapshot local → replica
make push-replica     # Compress + push to OCI Core Anchor
make replicate-loop   # Auto-replicate + push (daemon)
make status           # Full status panel
make monitor          # Tail all logs
make health           # Health check
make clean            # Purge temp files
```

## The Epistemic Gate (Sync Bridge)

When The_Beeper's data syncs to the Long-Term Lake:

| Event state | Synced to Green Band? |
|---|---|
| OBSERVED | Yes |
| DERIVED | Yes (with provenance) |
| INFERRED | **BLOCKED** |
| HYPOTHESIZED | **BLOCKED** |
