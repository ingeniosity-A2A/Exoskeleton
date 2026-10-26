# Exoskeleton

**Substrate chassis for Ava-007.**

Ava-007 has a DuckDB. Exoskeleton has a DuckDB. Exoskeleton holds the **Wasm** surface because of the Rust substrate. The **server** is created by the requirements between the two instances.

## Dual-instance fabric

```
Ava-007 DuckDB  ←→  Exoskeleton DuckDB (Wasm + server path)
                         │
                         ▼
                   REV.IKE (intake / curation functions)
```

## What this repository owns

| Owns | Does not own |
|------|--------------|
| Exoskeleton DuckDB (Wasm via Rust substrate) | Ava-007 cognitive DuckDB instance |
| Chassis schema, transition commit, skill ledger tables | Cognitive reasoning |
| REV.IKE task functions (intake, curate, grant-gated serve) | Provider API keys |
| pnpm workspace + catalog for substrate packages | Omnibus app shell / RSC pages |

## REV.IKE

REV.IKE keeps his name. Librarian describes his task functions only.

See `docs/REV_IKE.md`.

## Package management

- **pnpm only**
- Catalog is the single source of truth for shared versions
- Both `@duckdb/duckdb-wasm` and `duckdb` are cataloged (dual-engine)

## Completion tracking

See `COMPLETION_CHECKLIST.md`.
