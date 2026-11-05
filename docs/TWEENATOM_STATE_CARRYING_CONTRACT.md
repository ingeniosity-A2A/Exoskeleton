# TweenAtom State-Carrying Contract

**Owner split:** Cybernetic-Ava007 owns cognitive intent, acceptance and action-authorization policy. Exoskeleton owns typed state transport, temporal mechanics, persistence adapters, scheduling and synchronization. This document is additive; it does not modify Manifesto, Core Parameters, SICP or existing canon.

## 1. Three-part analogy, made operational

| Analogy | Engineering meaning | Concrete responsibility |
|---|---|---|
| Infrastructure | End-to-end service and data pipeline | Lens → DocLang → DuckDB → TurboVec/LEANN → Cradle → decision services → SmolDataEnvs/evaluation → Rustunnel/Tailscale transport |
| Payment | The means by which work is implemented and carried out | Rust is the implementation/execution substrate; it is not a payment protocol or a source of authority |
| Vehicle | The unit carrying state through the infrastructure | TweenAtom is the typed, versioned, provenance-bearing state-transition envelope |

The analogy is explanatory, not a substitute for interface contracts. Each stage must declare its input/output schema, authority, persistence behavior, failure modes and evidence.

## 2. TweenAtom definition

TweenAtom is the state-carrying unit for an intent or state transition. It connects the existing GSAP temporal semantics (transition law, easing, temporal coordinates, overwrite/generation behavior) with the Exoskeleton atomic substrate.

The existing compact 53-token representation remains a compact intent encoding, not the complete memory record. Token count is tokenizer/revision-specific. The typed envelope retains stable identity, stream identity, generation, predecessor/successor links, capability and intent kind, temporal transition, payload reference and digest, source provenance, policy version, authority receipt reference, and execution receipt reference.

A TweenAtom is not a free-standing LLM instruction string, an embedding or quantized vector, the authoritative Source Truth ledger by itself, proof that an operation was authorized or completed, or permission for REV.IKE or any model to write or execute.

## 3. End-to-end path

1. **Lens / sensory node:** transduces source stimulus and emits typed transcript data (DocLang, AudioLang, NetLang or another registered modality). It does not depend on retrieval.
2. **Docling + TableFormer:** preserve document layout, reading order, tables, cell spans, coordinates, formulas and source references. Extraction outputs remain attributable to the immutable source artifact.
3. **Atomicization:** create candidate atoms with stable IDs, content hashes, temporal metadata and derivation lineage. Candidate atoms remain pending.
4. **DuckDB Source Truth:** AVA-007's authorized acceptance path commits accepted observations and TweenAtom state. The ledger is durable; projections are rebuildable.
5. **Retrieval:** DuckDB applies tenant/role/policy/time/source filters before TurboVec or LEANN candidate search. TurboVec/LEANN return candidate references, never authority.
6. **Cradle / attention:** bounded candidate narrowing and traversal. Keep orchestration policy distinct from learned routing heads and external Drex services.
7. **Decision contributors:** local/remote models, Drex and d3-ultra produce evidence or proposals. Their outputs carry model revision, license, prompt/task, source references, uncertainty and trace IDs.
8. **AVA-007 gate:** AVA-007 alone accepts/rejects proposals and authorizes actions. The verified receipt is attached to the relevant TweenAtom.
9. **Rust execution substrate:** Exoskeleton validates schema, generation, temporal invariants, resource constraints and verified authority evidence, then dispatches only registered capabilities. Rust implements mechanics; it does not decide cognitive policy.
10. **Transport and reconciliation:** Tailscale Grants, Rustunnel and other registered paths carry bounded, authenticated payloads. Transport success is not ledger commit; the receiver acknowledges idempotent application.
11. **Evaluation / consolidation:** SmolDataEnvs and fixed held-out tests evaluate behavior. Evaluation outputs are evidence, not self-promotion. SPARC governs curation and promotion.

## 4. Lifecycle invariants

- Every atom has stable identity and monotonic generation within its stream.
- Every payload reference is content-addressed or carries a cryptographic digest.
- Every derived atom links to parent/source atoms and the exact derivation model or processor revision.
- Every temporal transition identifies its law, easing function, start/end coordinates and predecessor/successor lineage.
- Pending observations cannot enter accepted Source Truth.
- Accepted or rejected states require a verified AVA-007 receipt reference.
- Execution cannot start before AVA-007 acceptance/authorization.
- Succeeded requires an execution receipt; transport acknowledgement alone is insufficient.
- Failed and compensated transitions remain auditable; do not erase the original attempt.
- Vector indexes, caches, compressed codes, visual timelines and model context are rebuildable projections.
- No model, retrieval service, REV.IKE, sensory node or Rust subsystem can mint AVA-007 authority.

## 5. Implementation added in Exoskeleton

- packages/substrate-native/src/tween_atom.rs: typed Rust representation and validation.
- packages/substrate-native/src/lib.rs: module export.
- packages/memory-chassis/src/schema_tween_atom.sql: additive DuckDB table and indexes.
- docs/TWEENATOM_STATE_CARRYING_CONTRACT.md: this contract.

The Rust type validates local structure and receipt presence. It does not cryptographically verify receipts, execute capabilities, or write DuckDB. Those belong to the authorized adapter/runtime boundary and must be implemented and tested there.

## 6. Required test and benchmark work

- Rust unit tests: schema version, 53-token metadata, temporal bounds, digest, receipt requirements, execution-before-acceptance rejection and generation overflow.
- DuckDB migration test: apply after schema_20.sql and schema_kinetic.sql; test constraints and indexes against the pinned DuckDB 2.0 build.
- End-to-end: sensory fixture → DocLang → atomization → AVA-007 acceptance receipt → DuckDB commit → filtered TurboVec/LEANN retrieval → TweenAtom reconstruction → registered Exoskeleton capability → execution receipt → replay.
- Zero-copy: count copies/allocations at every boundary. Do not call pointer views or a shared mailbox end-to-end zero-copy without tracing the entire path.
- Performance: throughput, p50/p95/p99, allocations, bytes copied, memory high-water, CPU/energy, transaction latency, index build/rebuild, retrieval quality, ACL leakage (must be zero), offline replay and recovery.

**Status:** Source/schema/contract files are committed implementation candidates. No compile, migration, integration, deployment or benchmark result is asserted by this document.
