# Twin-Engine DuckDB State Fabric

**Status:** Canonical  
**Topology (locked):**

- **Ava-007** has a DuckDB instance (cognitive side).
- **Exoskeleton** has a DuckDB instance; **Wasm** lives here because of the Rust substrate.
- The **server** is created by the requirements between Ava-007 and Exoskeleton — not a third standalone product.

## Topology

```
[ Cognitive plugins / telemetry ]
              │
              ▼
Ava-007 DuckDB          ← cognitive-side instance
              │
              │  requirements / attach / materialization contract
              ▼
Exoskeleton DuckDB      ← substrate-side instance
  • Wasm isolate (Rust substrate)
  • Server / DuckLake path for long-term ledger
  • Schema: molecules, atomic_tweens, codebooks, skill ledger
              │
              ▼
Presentation / GPU consumers (zero-copy columnar handoff)
```

## Exoskeleton responsibilities

- Wasm surface (Rust substrate)
- Long-term schema and MVCC transition commit path
- Skill execution ledger tables + WAL cursor
- REV.IKE intake and curation functions over this chassis
- Remote attach surface so Ava-007 can query without copying

## Core tables

See `packages/memory-chassis/src/schema.sql`.

Generation-scoped timeline reads use `atomic_tweens.orchestrator_generation_id`.

## Design invariants

1. Absolute cognitive state is never stored as a static snapshot.
2. Only quantized temporal transition laws are persisted.
3. Dequantization is deferred until observation.
4. Ava-007 and Exoskeleton each hold an instance; the server path is their joint product.
5. Presentation consumers receive columnar buffers, never row-iterated objects.
