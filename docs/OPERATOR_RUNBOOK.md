# Exoskeleton Operator Runbook

## Framework boundary

This runbook operates the Exoskeleton repository only. Exoskeleton is the runtime substrate; Cybernetic-Ava007 owns governing intelligence; Omni-OS owns the operating environment; Rev.Ike is an Exoskeleton subsystem. A2A documentation belongs to MA Computing and is outside this repository's operational scope.

## Prerequisites

- Node.js version compatible with the root package and workspace dependencies.
- The exact pnpm version pinned in root `package.json`.
- Rust toolchain compatible with `packages/substrate-native/Cargo.toml`.
- Python 3 for `engine/rev_ike.py`.
- DuckDB CLI/runtime only for the applicable integration path.

Check actual pins before installing. Do not assume a proposed pnpm upgrade has happened.

## Checkout and install

```bash
git clone https://github.com/ingeniosity-A2A/Exoskeleton.git
cd Exoskeleton
node --version
pnpm --version
pnpm install --frozen-lockfile
```

If the frozen install fails, stop and reconcile the manifest/lockfile using the exact pinned package manager. Do not hand-edit the lockfile.

## Native substrate

```bash
cd packages/substrate-native
cargo test
cargo build --release
```

Do not expose the mailbox to concurrent production workloads until the memory-safety invariants in `docs/LAYER_0_MEMORY_PLANE.md` are satisfied and validated.

## Rev.Ike intake

```bash
cd <repository-root>
python3 engine/rev_ike.py
```

Confirm the engine's actual CLI contract before using it in automation. The Python entrypoint and TypeScript package are Exoskeleton-owned. Do not place provider secrets in source or logs.

## DuckDB schema

Canonical schema source currently present: `packages/memory-chassis/src/schema_20.sql`.

Apply only to disposable/test databases until schema compatibility, migration and recovery have been validated. Record DuckDB version, database mode, schema hash and command output. Do not assume the Wasm and server engines are interchangeable without a compatibility test.

## Integration boundaries

- Cybernetic-Ava007 supplies authorized intent; it is not installed or governed by this runbook.
- Omni-OS supplies concrete device/network/compute/browser environments.
- Exoskeleton invokes those environments through explicit capability contracts.
- A2A protocol setup and documentation are handled by MA Computing.

## Evidence

Every test, benchmark or integration claim must be recorded in `docs/VALIDATION.md` with date, commit SHA, OS/architecture, runtime/compiler versions, exact command and concise output. A successful install is not proof of end-to-end runtime completion.
