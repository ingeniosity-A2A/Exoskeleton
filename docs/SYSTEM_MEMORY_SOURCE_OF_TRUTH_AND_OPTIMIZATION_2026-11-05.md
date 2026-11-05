# System Memory Source of Truth and Whole-System Optimization Contract

**Recorded:** 2026-11-05  
**Repository:** `ingeniosity-A2A/Exoskeleton`  
**Status:** Architecture/engineering contract; not a release certification  
**Authority:** Implements the memory/runtime boundary defined by Cybernetic-Ava007. It does not amend any Manifesto or transfer cognitive authority.

> This document is the working source of truth for memory-system engineering, implementation mapping, optimization decisions, and benchmark acceptance. All future work must reconcile with this document and the linked canonical Ava-007 contracts before changing architecture or dependencies.

## 1. Repository authority and ownership

| System | Owns | Must not own |
|---|---|---|
| Cybernetic-Ava007 | Cognitive purpose, reasoning, Source Truth acceptance, interpretation policy, curation policy, authorization and action authority | Runtime substrate implementation |
| Exoskeleton | Runtime substrate, persistence, memory mechanics, synchronization, scheduling, transport, resource governance and capability boundaries | Ava-007 cognitive authority or Manifesto canon |
| REV.IKE | Read-only interpretation, retrieval/context preparation, observations and non-authoritative proposals | Source Truth writes, acceptance, promotion, authorization or execution |
| Ava007 Omni-OS | Device/OS/network/compute/hardware interfaces | Cognitive authority |
| Sensory nodes | Modality-specific perception and typed observations | Memory authority or automatic promotion |
| MA Computing | A2A documentation and communication architecture | Exoskeleton memory source of truth |

QAG_MemBrain is obsolete and excluded. The retired A2A Exoskeleton architecture is not a current architecture. No implementation, dependency, benchmark, migration, or documentation task may revive either.

## 2. Governing memory lifecycle

```text
Sensory capability
  -> typed observation
  -> AVA-007 authorized acceptance boundary
  -> Layer-0 publication / durable Source Truth write
  -> DuckDB structured ledger
  -> temporal reconstruction and event/outbox propagation
  -> rebuildable vector/retrieval projections
  -> REV.IKE read-only interpretation / proposal
  -> AVA-007 accept or reject
  -> authorized intervention
  -> measured outcome and audit
```

The system is second-order cybernetic: it measures the effects of its own perception, memory, retrieval, routing, curation and execution, then evaluates bounded changes. Feedback may create proposals; it cannot self-authorize, rewrite invariants, or promote itself.

### Truth and authority

| Layer | Domain | Authority / implementation |
|---|---|---|
| L0 | Source Truth | DuckDB schema_20 structured ledger plus Layer-0 SharedVectorMailbox transport; mailbox is not itself the durable ledger |
| L1 | Trust Truth | Tailscale identity, Grants and application authorization |
| L2 | Event/replication truth | Durable outbox, sequence, idempotent apply, acknowledgement and watermarks |
| L3 | Temporal Truth | Durable temporal records and GSAP-derived analytical/transition semantics |
| L4 | Relationship/retrieval truth | Rebuildable TurboVecQuant / vector projections; never authoritative |
| L5 | Interpretive Truth | REV.IKE read-only interpretation |
| L5A | Proposal Truth | Observation Proposals; non-authoritative pending AVA-007 decision |
| L6 | Action Truth | AVA-007-authorized execution through Exoskeleton/Omni-OS contracts |

Canonical review boundary: `Ledger Before -> REV.IKE Interpretation -> Ledger After`. Interpretation does not become memory until AVA-007 explicitly accepts it.

## 3. DuckDB 2.0 is the current database target; Arrow is not a required architecture layer

DuckDB 2.0.0 LTS ("Cinnamon Teal") was released 2026-10-21. The current `schema_20.sql` explicitly targets DuckDB 2.0.0. Its relevant capabilities include native triggers, first-class VARIANT, the Quack client/server protocol, asynchronous I/O, optimizer/engine improvements, and a new default storage format. The official migration guidance recommends shadow-system testing for mission-critical deployments; files written in the 2.0 storage format cannot be read by pre-2.0 engines.

Official references:
- Release: https://duckdb.org/2026/10/21/announcing-duckdb-200
- Migration: https://duckdb.org/docs/2.0/operations_manual/migration
- DuckDB 2.0 documentation index: https://duckdb.org/docs/2.0/whats_new_in_the_docs

**Architecture decision:** DuckDB 2.0 is the structured persistence/query engine under evaluation and the target of schema_20. Apache Arrow is an optional interchange/interop path, not a mandatory memory tier, canonical store, or assumed performance optimization. The presence of `arrow_ingest.ts` does not make Arrow mandatory. Do not add Arrow conversions to a hot path unless controlled measurements show a net system-level benefit.

### DuckDB 2.0 opportunities to evaluate as a whole system

1. **Native local/in-process execution:** benchmark the direct DuckDB path first; avoid serialization and protocol layers where they add no value.
2. **Appender / prepared ingestion:** compare DuckDB-native bulk ingestion and parameter-bound writes against current SQL construction and Arrow materialization.
3. **Triggers:** use transactional triggers for durable event/outbox capture where their semantics, overhead, ordering, and recovery are verified.
4. **Quack protocol:** evaluate DuckDB's native Quack server/client protocol for remote database access and shared database operations.
5. **VARIANT:** evaluate for flexible observation/proposal metadata where schema evolution benefits; keep typed, frequently filtered fields relational/typed.
6. **Async I/O:** evaluate for remote Parquet/CSV/native-storage reads; do not assume it accelerates the in-memory mailbox or local hot write path.
7. **Optimizer and physical layout:** measure indexes, clustering/order, projection, compression, query plans, checkpointing, and batch size against actual memory/retrieval workloads.
8. **C API v2:** DuckDB's 2.0 documentation describes the revamped C API v2 as not yet stable. Do not hard-bind the native arena to an unstable API without a pinned compatibility layer and explicit version gate.

### Quack naming collision — mandatory clarification

There are two distinct things and they must never be conflated:

- **DuckDB Quack protocol:** DuckDB's native client/server protocol and extension.
- **Application outbox/apply mechanism:** this repository's `quack_outbox`, `quack_sync.ts`, `quack_apply.ts`, sequence and watermark records.

The application outbox is not automatically the DuckDB Quack protocol. Preserve current names until a reviewed migration is approved, but document them as **application replication outbox** in prose and telemetry. Evaluate whether native DuckDB Quack can replace any custom transport/synchronization code without weakening offline-first durability, identity/Grant checks, idempotency, auditability, or recovery. Do not assume it replaces the outbox's application semantics.

## 4. Whole-system data path and copy accounting

The benchmark must follow one payload and one identity through the complete lifecycle:

```text
sensory producer
  -> typed observation / packed representation
  -> native aligned arena or mailbox
  -> FFI / Node / Wasm boundary
  -> DuckDB 2.0 transaction and durable ledger
  -> outbox / replication
  -> retrieval projection
  -> query / replay / REV.IKE proposal
  -> AVA-007 acceptance decision
```

For every boundary, record:
- bytes in/out and whether the representation changes;
- allocation count and allocated bytes;
- copy count and bytes copied;
- ownership, mutability, lifetime and pin/lease duration;
- serialization/deserialization and encoding costs;
- CPU time, wall time, throughput, p50/p95/p99 latency;
- peak resident memory, retained memory and write amplification;
- durable commit latency, checkpoint/flush behavior and recovery time.

A pointer view is not proof of end-to-end zero-copy. A buffer can be zero-copy at one boundary and copied at the next. DuckDB persistence necessarily has an ownership/durability boundary; report this explicitly rather than hiding it inside an "Arrow zero-copy" claim.

### Candidate ingress paths — benchmark, do not presume

| Candidate | Role | Decision status |
|---|---|---|
| Native packed arena -> DuckDB-native bulk/appender API | Potential lowest-overhead local ingestion | First candidate to measure |
| Native packed arena -> bound prepared statements / BLOB batches | Simpler transactional route | Required baseline |
| Native/Wasm memory -> Arrow C Data / Arrow stream -> DuckDB | Interop and columnar batch candidate | Optional comparator; not canonical |
| DuckDB native Quack client/server | Remote/shared DB transport | Separate network/replication experiment |
| Custom application outbox/apply | Offline-first event durability and deterministic reconciliation | Preserve until native alternative passes semantic gates |

Do not pass a native process pointer as a Wasm linear-memory offset. Do not hold a Wasm memory view across an operation that may grow/reallocate memory. Do not retain borrowed arena views beyond the arena's immutable lease. Materialize only where required by database ownership or asynchronous lifetime constraints, and count that materialization.

## 5. Current implementation inventory and boundaries

Verified paths in Exoskeleton `main` at the time of this record:

- `packages/substrate-native/src/memory_plane.rs` — Layer-0 SharedVectorMailbox; atomic-byte storage and validated copy snapshots. It deliberately does not expose a plain pointer into concurrently mutable atomic-byte storage.
- `packages/substrate-native/src/mailbox_ingest.rs` — packed mailbox ingestion.
- `packages/substrate-native/src/packed_codes_ffi.rs` — 64-byte-aligned packed-code arena and C ABI view functions; borrowed view lifetime is bounded by arena lifetime and immutability.
- `packages/substrate-native/src/dfm_parametric.rs` — DFM-related experimental native support; not a trained DFM model.
- `packages/substrate-native/src/consensus.rs` — experimental coordination support; not proof of formal distributed convergence.
- `packages/memory-chassis/src/schema_20.sql` — DuckDB 2.0 schema, records, triggers, outbox and watermarks.
- `packages/memory-chassis/src/data/TwinEngineMatrix.ts` — transactional ingress adapter.
- `packages/memory-chassis/src/data/quack_sync.ts` and `quack_apply.ts` — application replication outbox/apply path.
- `packages/memory-chassis/src/data/arrow_ingest.ts` — optional Arrow/Wasm ingestion adapter; not a mandatory pipeline stage.
- `packages/memory-chassis/src/kernel/TemporalSubstrate.ts` and `transition.ts` — temporal semantics and transition persistence.
- `packages/memory-chassis/src/dream/dream_rsi.ts` — replay/candidate evaluation.
- `packages/memory-chassis/src/types/CognitiveState.ts` — typed state contract.
- `packages/librarian/` and `engine/rev_ike.py` — Rev.Ike intake/curation subsystem, subordinate to AVA-007 authority.

The package modules are the current repository paths. Do not reintroduce the absent `apps/omnibus` tree or claim feed-only files are integrated. The feed integration and patch-status records remain the change ledger; their caveats remain in force.

## 6. System optimization policy

Optimize the complete workload, not a favored library or isolated microbenchmark. The objective is constrained multi-objective improvement:

- preserve all manifesto, trust, authority, provenance, consistency and recovery invariants;
- minimize end-to-end latency, bytes copied, allocations, memory footprint, energy and write amplification;
- maximize throughput, retrieval quality, recall, availability and reproducibility;
- account for local, offline, Wasm, native and remote deployment modes;
- report trade-offs rather than collapsing them into one score.

No optimization is accepted if it improves speed by weakening correctness, durability, privacy, authorization, retrieval quality, or required capability.

### Mandatory benchmark matrix

Run the same datasets, payload sizes, operation mix, concurrency, hardware, runtime, and durability settings across candidates.

| Workload | Required measurements |
|---|---|
| Native arena append/read | allocations, alignment, copies, throughput, latency |
| Mailbox publish/snapshot | contention, retry rate, generation correctness, bytes copied |
| FFI / Node / Wasm transfer | copies, lifetime safety, boundary overhead, memory growth |
| DuckDB local ingest | rows/blocks per second, commit latency, WAL/checkpoint, memory |
| Query/retrieval | plan, cold/warm latency, p50/p95/p99, recall/precision |
| Outbox/apply | lag, batch throughput, duplicate/replay handling, convergence |
| Native Quack transport | network throughput/latency, auth, failure/reconnect, consistency |
| Arrow comparator | conversion overhead, peak memory, end-to-end time vs native path |
| Dream-RSI/consolidation | candidate quality, reproducibility, query cost, resource use |
| Full lifecycle | end-to-end latency, total copies/allocations, durability, recovery, capability quality |

Benchmark at representative payload sizes (small/medium/large), batch sizes, concurrency levels, cold and warm cache, online/offline transitions, and failure injection. Publish raw data, exact commands, build IDs, database versions, CPU/OS/runtime, configuration, dataset hashes, and analysis scripts.

## 7. Safety, correctness and migration gates

Before trusting performance numbers:

1. **Rust memory model:** review mailbox publication, slot reuse, atomic ordering, aliasing, publisher serialization, and reclamation. Run unit/stress tests and Miri or an appropriate concurrency model checker.
2. **Arena/FFI:** validate checked allocation failure paths, C ABI pointer validity, thread-safety, use-after-free prevention, immutability, and lease/release behavior.
3. **Wasm:** test actual exported Wasm memory identity, memory growth, pointer bounds, and view invalidation.
4. **DuckDB 2.0 schema:** execute schema_20 on the exact pinned server and Wasm builds; test every trigger, constraint, transaction, type, and recovery path.
5. **Dual-engine compatibility:** define precisely which two engines are meant, pin their exact versions/builds, and prove schema and behavioral equivalence before any first write. No mixed-version writes.
6. **Outbox:** test ordering, duplicate delivery, crash/restart, partial batch, empty snapshot, stale-row deletion, watermark atomicity, replay and offline recovery.
7. **Quack protocol:** separately test native DuckDB Quack auth, transport failure, reconnect and database semantics; do not substitute it for the application outbox without parity evidence.
8. **Retrieval:** validate quantization error, recall/precision, projection rebuild, stale-index recovery and baseline quality.
9. **Dream-RSI:** validate exact evidence-to-tween linkage, invalid inputs, finite scores, replay determinism and prediction-error accounting.
10. **Authority:** prove REV.IKE cannot mutate Source Truth and only AVA-007 can accept proposals or authorize actions.
11. **Migration:** shadow-copy real workload, validate backup/restore and rollback. DuckDB 2.0's new storage format is not readable by pre-2.0 DuckDB; do not downgrade by pointing an older engine at a 2.0-written database.

## 8. Status labels — no inferred completion

Use only these labels:
- **Specified:** contract/documentation exists.
- **Implemented:** source code exists at the cited revision.
- **Compiled:** exact build command completed successfully.
- **Tested:** named tests completed successfully with output.
- **Benchmarked:** reproducible measurements and raw artifacts exist.
- **Deployed:** exact target environment is running the identified build.
- **Accepted:** all correctness, security, quality and performance gates passed and approval is recorded.

A source file is not proof of compilation, tests, benchmark results, deployment or acceptance. Proposed targets are not achieved measurements.

## 9. Required change protocol

Every future agent, contributor, or engineering session must:

1. Read Cybernetic-Ava007's Declaration of Intent, Manifesto canon/gates and current engineering standards.
2. Read this document and the current Exoskeleton memory source truth, feed integration, patch status and validation records.
3. Inspect the actual target branch HEAD and source files before editing; never rely on stale trees or chat-only diagrams.
4. Map proposed changes to the complete system and identify downstream effects, alternatives and measurable benefits.
5. Preserve authority boundaries and existing Manifesto wording.
6. Update source, tests, benchmark evidence, validation ledger and architecture documents together.
7. Record exact commit SHA, versions, commands, results, limitations and rollback path.
8. Never silently promote an optional dependency (including Arrow) into a required architecture component.

## 10. Explicit non-claims

- This document does not certify end-to-end zero-copy.
- It does not certify Rust memory safety, native/Wasm FFI safety, schema_20 execution, dual-engine equivalence, Quack convergence, retrieval quality, or production readiness.
- It does not claim Arrow is obsolete; it removes Arrow's assumed mandatory status and requires comparative evidence.
- It does not claim DuckDB native Quack replaces the application outbox.
- It does not authorize code migration, schema migration, dependency removal, or Manifesto changes.
- It excludes QAG_MemBrain and the retired A2A Exoskeleton architecture.

**The engineering objective is the best correct, secure, durable, measurable system as a whole—not the fastest isolated component.**
