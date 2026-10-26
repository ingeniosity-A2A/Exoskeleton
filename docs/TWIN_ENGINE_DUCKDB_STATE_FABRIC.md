# Twin-Engine DuckDB State Fabric

**Status:** Canonical  
**Repository authority:** Exoskeleton owns Layer 1b

## Topology

```
[ Cognitive plugins / telemetry ]
              │  high-frequency event streams
              ▼
Layer 1a   In-process short-term memory (DuckDB Wasm isolate)
           Vectorized scratchpad, radix-partitioned hash builds,
           zero-copy Apache Arrow record batches
              │  asynchronous pipeline / Quack remote protocol
              ▼
Layer 1b   Core chassis long-term memory (DuckDB Server / DuckLake)
           Global columnar ledger, bitpacked Parquet footers,
           MVCC WAL, background zero-copy materialization of
           TurboVecQuant buffers
              │  direct hardware texture / buffer bindings
              ▼
Layer 4    Presentation plane (GPU uniform blocks / PBO)
           Zero CPU math loop; GPU-side trajectory evaluation
```

## Layer 1b Responsibilities (this repository)

- Persistent storage of transition laws, not static snapshots
- Schema for molecules, atomic tweens, and quantized codebooks
- Optimistic concurrency with latest-wins resolution on the temporal axis
- Materialization of compressed transition buffers for downstream consumers
- Remote attachment surface so short-term isolates can query without copying

## Core Tables (target)

```sql
-- Master temporal container
CREATE TABLE research_molecules (
    molecule_id       TEXT PRIMARY KEY,
    identity_did      TEXT NOT NULL,
    total_duration_ms INTEGER DEFAULT 0,
    created_at        INTEGER DEFAULT (unixepoch())
);

-- State-transition edge (doubly-linked temporal node)
CREATE TABLE atomic_tweens (
    tween_id        TEXT PRIMARY KEY,
    molecule_id     TEXT NOT NULL,
    target_property TEXT NOT NULL,
    start_value     REAL NOT NULL,
    end_value       REAL NOT NULL,
    start_time_ms   INTEGER NOT NULL,
    duration_ms     INTEGER NOT NULL,
    easing_code_id  INTEGER NOT NULL,
    prev_tween_id   TEXT UNIQUE,
    next_tween_id   TEXT UNIQUE,
    FOREIGN KEY (molecule_id) REFERENCES research_molecules(molecule_id)
);

CREATE INDEX idx_temporal_axis
    ON atomic_tweens(molecule_id, start_time_ms);

-- Quantized easing / wavefunction codebooks
CREATE TABLE turboquant_codebooks (
    codebook_id     INTEGER PRIMARY KEY,
    curve_name      TEXT UNIQUE,
    quantized_levels BLOB NOT NULL,
    orthogonal_seed INTEGER NOT NULL
);
```

## Design Invariants

1. Absolute cognitive state is never stored as a static snapshot.
2. Only quantized temporal transition laws are persisted.
3. Dequantization is deferred until the moment of observation (lazy).
4. Short-term and long-term engines share the same analytical model; they differ only in lifetime and location.
5. Presentation consumers receive columnar buffers, never row-iterated objects.

## Non-Goals

- This repository does not host the Wasm short-term isolate.
- This repository does not own GPU shaders or the presentation loop.
- This repository does not perform cognitive reasoning.
