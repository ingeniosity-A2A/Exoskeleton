# Twin-Engine DuckDB State Fabric

**Status:** Canonical (DuckDB 2.0 LTS source of truth)

## Topology

- **Ava-007** — DuckDB cognitive-side instance
- **Exoskeleton** — DuckDB Wasm (Rust substrate) + server path
- **Server** — product of requirements between the two instances

Migration gate: both engines on **2.0** before first write. Pre-2.0 cannot read 2.0 storage.

## Schema

Canonical DDL: `packages/memory-chassis/src/schema_20.sql`

- `atomic_tweens` with `easing_code_id`, `orchestrator_generation_id`
- Triggers enforce Law of Overwrite → `quack_outbox`
- `turboquant_blocks`, `skill_registry` (VARIANT), skill ledger, watermarks

## Runtime path

```
HolographicTemporalEngine
  → atomToRow
  → TwinEngineMatrix.appendTransitionLogTransactional
  → tg_outbox_* triggers
  → QuackOutbox.pump → QuackNativeTransport
  → QuackApply (1b receiver)
```

Arena materialization: `arrow_ingest.ingestArenaBlocks` (one copy into turboquant_blocks).

## Presentation

GLSL: `packages/memory-chassis/src/shaders/ease.glsl` (`backOut`, `spinodal`).
