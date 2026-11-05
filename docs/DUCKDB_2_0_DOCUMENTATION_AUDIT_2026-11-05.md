# DuckDB 2.0 Documentation Audit — Exoskeleton

**Audit date:** 2026-11-05  
**Status:** Official-documentation analysis; not implementation or benchmark evidence.  
**Applies to:** Exoskeleton memory system, DuckDB 2.0 target, kinetic zero-copy evaluation.

Primary index: https://duckdb.org/docs/2.0/whats_new_in_the_docs

## 1. Findings that change the system design

### Quack: remote database protocol, not event bus
Official: https://duckdb.org/docs/2.0/quack/overview

Quack exposes a DuckDB session/database to DuckDB clients over HTTP(S), using DuckDB's `application/duckdb` serialization. It is client-driven request/response, not server-initiated push. The server's visible session state (in-memory tables, attached files and schemas) becomes reachable remotely. It defaults to localhost; external binding requires opt-in. Remote connections use HTTPS by default, but non-local servers default to a self-signed certificate unless configured otherwise. Authentication is required; production guidance recommends localhost binding behind a TLS-terminating reverse proxy.

**Decision:** Evaluate Quack for remote database access/query routing over the private network. It does not inherently replace application outbox semantics: durable event identity, replay, consumer acknowledgement, offline queueing, idempotent apply, or per-operation Grants. Test visibility boundaries, authentication, reconnect, concurrent clients, and failure recovery. Do not expose it publicly or assume Tailscale identity alone is database authorization.

### Triggers: useful, but not a transparent outbox replacement
Official: https://duckdb.org/docs/2.0/sql/statements/create_trigger

DuckDB 2.0 supports triggers on INSERT, UPDATE and DELETE, including statement-level transition tables. Important limitations:
- BEFORE row-level triggers are unsupported.
- UPDATE row-level triggers are unsupported.
- RETURNING is unsupported on tables with row-level triggers.
- INSTEAD OF triggers and triggers on views are unsupported.
- MERGE is unsupported on tables with triggers.
- INSERT ON CONFLICT, INSERT OR REPLACE and INSERT OR IGNORE are merge operations and fail on tables with UPDATE or DELETE triggers.
- Row-level and statement-level triggers cannot be mixed for the same event on a table.

**Decision:** Map every write in TwinEngineMatrix, quack_apply, schema migrations and sync before changing outbox logic. Test upserts/deletes, rollback, trigger ordering, multi-row statements and crash recovery. Keep explicit application outbox writes wherever trigger limits or application semantics require them.

### VARIANT: typed semi-structured storage, not universal schema replacement
Official: https://duckdb.org/docs/2.0/sql/data_types/variant

VARIANT stores typed binary values with per-value type metadata. DuckDB documents better compression/query performance than JSON text for semi-structured data. Persisted values can be shredded into typed columns when row groups reach the configured threshold; the default `variant_minimum_shredding_size` is 30,000 rows.

**Decision:** Benchmark VARIANT for evolving sensory payloads, modality-specific metadata and proposal evidence. Keep stable IDs, timestamps, authority/Grant fields, sequence, status and provenance keys as explicit typed columns. Do not assume shredding for small or sparse datasets. Verify native and Wasm support in exact pinned builds.

### Asynchronous I/O: relevant to storage scans, not a generic zero-copy switch
Official: https://duckdb.org/docs/2.0/data/io

DuckDB 2.0 async I/O supports Parquet, uncompressed seekable UTF-8 CSV, and DuckDB native storage. It overlaps blocking reads with query processing. It does not inherently accelerate mailbox publication, FFI transfer, or in-memory queries. The async thread pool defaults to four times the system thread count (capped at 256); read-ahead consumes memory and interacts with the memory manager.

**Decision:** Measure only on supported persistent-file workloads. Explicitly cap threads/read-ahead for the 6-vCPU VPS and mobile edge; measure memory and tail latency.

### Durability is part of performance
DuckDB's `fsync_mode = NONE` skips stable-storage synchronization and may cause data loss/corruption after OS crash or power loss. Do not use it for authoritative Source Truth performance claims. Benchmarks must compare equivalent durability settings and report commit/flush behavior.

### Appender and C API are language/version-specific
The documented Python appender is a Python API; it does not prove equivalent Rust or Node APIs. Compare it only where Python is in the actual target path. For Rust/Node, test supported prepared/batched ingestion and stable native APIs. DuckDB 2.0 C API v2 is not yet stable; do not make it a foundational ABI dependency for packed_codes_ffi.rs or napi_bridge.rs without a pinned wrapper and upgrade gate.

## 2. Revised experiment order

1. Pin exact DuckDB 2.0 native and Wasm builds; execute schema_20.sql against both.
2. Profile the current local write path and count allocations, copies, encoding, and persistence costs.
3. Compare native DuckDB bulk/prepared ingestion against the current path with identical payloads and durability.
4. Evaluate VARIANT for variable observation payloads; keep invariant fields typed.
5. Compare statement-level triggers with current outbox semantics; retain explicit outbox logic wherever trigger limits prevent parity.
6. Evaluate Quack separately for authenticated remote DB access; test private-network behavior, access visibility, failures and reconnect.
7. Measure async I/O only for supported storage scans; tune resource budgets for VPS and edge.
8. Compare optional Arrow interoperability with the best native path. Keep it only if it wins a full-lifecycle workload or meets a real interoperability requirement.
9. Run the full kinetic lifecycle with durability, authority and recovery gates intact.

## 3. Benchmark acceptance rule

Measure the same payloads, dataset, operation mix, batch sizes, concurrency, hardware and durability across candidates. Record bytes copied, allocations, ownership/lifetime, serialization, throughput, p50/p95/p99 latency, peak memory, commit/flush time, recovery, retrieval quality and CPU/energy where measurable.

A local pointer view is not end-to-end zero-copy. A feature is not accepted because its documentation says it is faster in a different workload.

## 4. Explicit non-claims

This audit does not claim that Quack, triggers, VARIANT, async I/O, Python appender or C API v2 are integrated or tested in Exoskeleton. It does not certify DuckDB schema compatibility, zero-copy, performance, production readiness, or authorize schema/dependency migration. Arrow remains optional—not declared obsolete—until measured evidence decides.
