# Memory — Dual-Band DuckDB Architecture

## Two Bands, Two Databases

```
┌─────────────────────────────────┐
│ Short-Term DuckDB (Orange Band) │  Reflexive / Hot State
│                                 │  - Active session state
│ - Atomic mailbox edges          │  - Provisional probes
│ - Active workspace              │  - Atomic facts (L1)
│ - Orange Band probes            │  - High-frequency telemetry
│ - Sensory events                │  - Session-scoped data
└──────────────┬──────────────────┘
               │
               │  EPISTEMIC GATE
               │  OBSERVED  → ✓
               │  DERIVED   → ✓
               │  INFERRED  → ✗
               │  HYPOTHESIZED → ✗
               │
┌──────────────▼──────────────────┐
│ Long-Term DuckDB Lake           │  Verified / Green Band
│ (Green Band)                    │
│ - Validated SOPs                │  - Fact atoms (L1)
│ - L1 Fact Atoms                 │  - Audit ledger
│ - Immutable audit ledger        │  - Dependency index
│ - Cross-session memory          │  - Replication log
└─────────────────────────────────┘
```

## Schemas

| File | Purpose |
|---|---|
| `schemas/dependency_index.sql` | Dependency tracking, host interfaces, audit ledger |
| `schemas/fact_atoms.sql` | L1 fact atoms, temporal tracking, provenance |

## DuckDB 2.0 Features Used

| Feature | Usage |
|---|---|
| `COPY DATABASE TO ... (FORMAT PARQUET)` | Cold replication |
| `IMPORT DATABASE FROM ...` | Snapshot restore |
| Window functions | Cross-session aggregation |
| JSON support | Structured metadata |
| Hash functions | BLAKE2b content hashing |
