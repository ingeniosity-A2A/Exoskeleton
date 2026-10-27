# Exoskeleton

**Substrate chassis for Ava-007.**

Ava-007 has a DuckDB. Exoskeleton has a DuckDB (Wasm via Rust substrate). The **server** path is the product of requirements between the two instances.

**Repo:** https://github.com/ingeniosity-A2A/Exoskeleton  
**Supersedes:** `A2A-Exoskeleton` (sunset / archive)

## Layout

```
packages/memory-chassis/   schema_20, Quack, TwinEngine, Dream-RSI, rubric, Arrow ingest
packages/substrate-native/ Layer 0 SharedVectorMailbox + C ABI
packages/librarian/        REV.IKE intake/curator/grants (TS)
engine/rev_ike.py          Zero-copy intake engine (fail-closed from TS)
docs/                      Authority, validation, discrepancy, vector core
```

## Dual-instance fabric

```
Ava-007 DuckDB  ←→  Exoskeleton DuckDB (Wasm + server path)
                         │
                         ▼
                   REV.IKE (intake / curation functions)
```

## Package management

- **pnpm only** — see `pnpm-workspace.yaml` catalog (DuckDB 2.0 lockstep)
- Apply `packages/memory-chassis/src/schema_20.sql` on **both** engines before first write

## Operator completion

See `docs/OPERATOR_RUNBOOK.md` and `COMPLETION_CHECKLIST.md`.  
Claims stay **[R]** until dated evidence is in `docs/VALIDATION.md`.

## REV.IKE

Name is **REV.IKE**. Librarian describes task functions only.
