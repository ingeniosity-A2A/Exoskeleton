# Operator runbook — runtime completion

## Prerequisites

- Node ≥ 20 (22+ preferred), pnpm matching `packageManager`
- Rust stable, Python 3, optional `psutil`

## Install

```bash
git clone https://github.com/ingeniosity-A2A/Exoskeleton.git
cd Exoskeleton
pnpm install
```

Confirm lockfile resolves `duckdb` and `@duckdb/duckdb-wasm` at 2.x.

## Schema (both engines)

```bash
# Native example
duckdb chassis.duckdb < packages/memory-chassis/src/schema_20.sql
```

Wasm: load `@duckdb/duckdb-wasm`, execute same SQL file.  
Record table list in `docs/VALIDATION.md` as **[M]**.

## Cargo

```bash
cd packages/substrate-native && cargo test && cargo build --release
```

## Intake

```bash
python3 engine/rev_ike.py
```

TS bridge fail-closes if engine missing: `packages/librarian/src/intake.ts`.

## Validation

Only dated command output in `docs/VALIDATION.md` promotes **[R] → [M]**.
