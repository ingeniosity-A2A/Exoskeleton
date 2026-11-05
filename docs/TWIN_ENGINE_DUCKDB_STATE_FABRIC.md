# DuckDB State Fabric

**Scope:** Exoskeleton memory/data integration  
**Status:** design and source map; runtime compatibility must be measured

## Topology and authority

The Exoskeleton data plane may exchange approved state and artifacts with other framework components, but it does not transfer intelligence authority or repository ownership.

- Cybernetic-Ava007 remains the governing intelligence authority.
- Exoskeleton owns its runtime data plane and schema/migration code in this repository.
- Omni-OS owns the environment in which supported database/runtime processes execute.
- Rev.Ike owns Exoskeleton intake and curation functions.
- MA Computing owns A2A documentation and protocol material.

Do not interpret “twin engine” as a second independent Ava007 intelligence or as an A2A architecture.

## Current source references

- Schema source: `packages/memory-chassis/src/schema_20.sql`.
- Data and transition code: `packages/memory-chassis/src/data/`.
- Quack apply/sync code: `packages/memory-chassis/src/data/quack_apply.ts`, `quack_sync.ts`.
- Matrix integration: `packages/memory-chassis/src/data/TwinEngineMatrix.ts`.
- Arrow ingestion: `packages/memory-chassis/src/data/arrow_ingest.ts`.

## Intended data path

```
validated transition / artifact
        |
        v
transactional append
        |
        v
database outbox
        |
        v
Quack transport / synchronization
        |
        v
receiver apply + idempotency checks
        |
        v
reconciliation and recovery evidence
```

This is the intended integration shape. Verify actual function names, transactional guarantees, ordering and idempotency in code before relying on this diagram operationally.

## Schema and migration controls

- Pin and record the exact DuckDB runtime/version for each supported target.
- Validate schema compatibility before first write.
- Apply migrations to disposable test databases first.
- Record schema hash, table inventory, runtime mode and migration output.
- Test rollback, crash recovery, duplicate delivery and partial batch replay.
- Do not assume a Wasm database and native/server database have identical persistence or concurrency behavior.

## Copy and materialization accounting

Arrow buffers, WASM views and database insertion paths must be measured independently. A view or subarray does not prove end-to-end zero-copy. Record copies, allocations, serialization and persistence boundaries.

## Acceptance criteria

- Schema migration is repeatable and versioned.
- Outbox operations are transactional with source mutations.
- Receiver apply is idempotent.
- Crash/restart recovery is demonstrated.
- Data lineage and authorization are preserved.
- Cross-runtime compatibility is measured rather than assumed.
