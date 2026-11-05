# Exoskeleton Memory System — Feed Capture and Source Truth

**Recorded:** 2026-11-05  
**Repository:** `ingeniosity-A2A/Exoskeleton`  
**Scope:** Exoskeleton-owned runtime memory substrate. This record captures the memory-system decisions and implementation inventory surfaced in the current Ava-007 engineering feed.  
**Authority:** Additive implementation record. It does not amend AVA-007 Manifesto/Core Canon or transfer cognitive authority to Exoskeleton.

## 1. Repository and ownership boundary

- **Cybernetic-Ava007** owns cognitive purpose, reasoning, interpretation, acceptance of observations into Source Truth, curation policy, and authorization.
- **Exoskeleton** owns runtime execution, persistence adapters, memory substrate mechanics, synchronization, scheduling, transport, and resource governance.
- **REV.IKE** is read-only interpretation/candidate generation. It may produce observations and Observation Proposals; it cannot write Source Truth, accept proposals, authorize promotion, or execute actions.
- **Omni-OS** owns device and operating-environment interfaces.
- Network reachability is not application authorization. Tailscale identity and Grants are both required where remote access is used.
- **QAG_MemBrain is obsolete and is not an active memory-system target.** Do not route new work or data to it.

## 2. Current Truth layers

| Layer | Truth domain | Current authority / implementation boundary |
|---|---|---|
| L0 | Source Truth | Dual DuckDB schema_20 + Layer-0 SharedVectorMailbox; Exoskeleton substrate |
| L1 | Trust Truth | Tailscale identity + Grants and application-level authorization |
| L2 | Consensus / Outbox Truth | Quack/outbox triggers and apply watermarks over Dual DuckDB |
| L3 | Temporal Truth | Dream-RSI records plus GSAP-derived temporal substrate |
| L4 | Relationship Truth | TurboVecQuant/retrieval projection; rebuildable from authoritative records |
| L5 | Interpretive Truth | REV.IKE read-only interpretation |
| L5A | Proposal Truth | Observation Proposal records; non-authoritative until reviewed |
| L6 | Action Truth | AVA-007 Runtime; execution remains subject to explicit authorization and Exoskeleton runtime contracts |

Canonical review boundary:

`Ledger Before → Interpretation (REV.IKE) → Ledger After`

REV.IKE interpretation alone does not mutate the ledger. Any accepted change must be an explicit AVA-007 decision, recorded with provenance and audit evidence.

## 3. Memory system components present in this repository

The following paths were verified in the `main` tree at capture time:

- `packages/memory-chassis/src/schema_20.sql` — DuckDB schema for temporal atoms, quantized blocks, skill registry/rubrics, execution ledger, Quack outbox/watermarks, and Dream-RSI sessions/candidates.
- `packages/substrate-native/src/memory_plane.rs` — Layer-0 SharedVectorMailbox source, fixed ring slots, generation metadata, publication, snapshot-copy API, raw pointer escape hatch, and unit tests.
- `packages/substrate-native/src/mailbox_ingest.rs` — packed mailbox ingestion bridge.
- `packages/memory-chassis/src/dream/dream_rsi.ts` — historical analog retrieval, candidate scoring, seeded path selection, persistence of dream sessions/candidates, and prediction-error closure.
- `packages/memory-chassis/src/data/quack_sync.ts` and `quack_apply.ts` — outbox synchronization and apply path.
- `packages/memory-chassis/src/data/arrow_ingest.ts` — Arrow ingestion adapter.
- `packages/memory-chassis/src/kernel/TemporalSubstrate.ts` and `transition.ts` — temporal substrate and transition logic.
- `docs/LAYER_0_MEMORY_PLANE.md` — Layer-0 boundary, memory-safety requirements, copy accounting, and validation requirements.
- `docs/VECTOR_CORE.md` — vector encoding, mailbox, database materialization, TurboVec integration seam, and open evaluation requirements.
- `docs/VALIDATION.md` — repository validation status and evidence requirements.

This is a source inventory, not a declaration that all paths are production-ready.

## 4. Atomic, vector, temporal, and ledger semantics

- **Atomic** denotes capability intent/state transitions and their generation boundaries.
- **Vector** denotes sensory/semantic vector payloads and retrieval representations.
- **GSAP temporal substrate** owns temporal transition semantics and analytical reconstruction; it is not a real-time physical controller.
- **DuckDB** is the structured persistent ledger/data platform.
- **Quack** carries durable outbox/apply state and synchronization evidence.
- **TurboVec/TurboVecQuant** are retrieval/projection mechanisms. Their outputs are rebuildable and do not supersede Source Truth.
- **Dream-RSI** records candidate paths, predicted scores, actual scores, and prediction error. A dream candidate is not authority to mutate Source Truth.
- **SharedVectorMailbox** is an in-process transport primitive; cross-process sharing requires a separately specified and verified transport contract.

## 5. Memory lifecycle and second-order feedback

The intended loop is:

`observe → record → interpret → propose → review → accept/reject → intervene → measure effect → reevaluate`

The second-order loop measures the effects of the system's own routing, retrieval, curation, refactoring, and execution choices. Feedback can produce bounded proposals; it cannot grant itself authority or alter governing invariants.

Required EPIC-007 review lifecycle:

`Observation Proposal → Review → Acceptance/Rejection → Audit`

- REV.IKE can submit a proposal.
- AVA-007 alone accepts or rejects it.
- Accepted changes are committed through the authorized Source Truth write path.
- Rejected proposals remain audit-only.
- Every decision binds source identity, content digest, reviewer, decision, timestamp, and resulting ledger revision.

## 6. Offline and synchronization requirements

- Local-first operation must preserve durable writes in an outbox.
- No unverified cloud acknowledgement is treated as a committed Source Truth update.
- Reconciliation is idempotent and keyed by stable source identity and sequence/watermark.
- Conflict handling is explicit and auditable.
- Operator overrides are authenticated, scoped, and recorded.
- Offline state must not silently disappear when transport is unavailable.

## 7. Safety and validation status

The Layer-0 documentation correctly warns that a seqlock retry loop does not by itself make concurrent non-atomic payload reads/writes sound under Rust's memory model. The current mailbox source includes unsafe raw-pointer APIs and debug-only publisher ownership enforcement. Therefore:

- Do not claim the mailbox is fully sound based solely on the source comments or round-trip unit tests.
- Review release-mode publisher cardinality and slot reuse.
- Verify reader/writer synchronization, aliasing, lifetime, and reclamation under Rust's memory model.
- Run appropriate concurrency stress/model checks and Miri or equivalent review.
- Validate FFI, Node/WASM, and Arrow/DuckDB ownership/lifetime boundaries.
- Measure copies and allocations per boundary before claiming zero-copy.
- Verify schema_20 against the exact deployed DuckDB build and both database engines before first write.
- Validate Quack idempotence, replay, watermark recovery, outbox overflow, and snapshot/resync.
- Validate Dream-RSI SQL correctness, injection resistance, insufficient-history behavior, reproducibility, and prediction-error accounting.
- Validate TurboVec/TurboVecQuant encoding, distance error, recall, and performance against a named baseline.

**Status at capture:** source files and architecture documents are present. Full memory-plane soundness, end-to-end zero-copy, integration, deployment, and benchmark acceptance are not certified by this feed capture.

## 8. Explicit exclusions and historical material

- Do not use QAG_MemBrain; it is obsolete.
- Do not revive the retired A2A Exoskeleton architecture name or move AVA-007 cognition into Exoskeleton.
- Do not treat older JSONL/Tashi/Neo4j memory ordering as current Source Truth.
- Do not treat local SQLite retain prototypes or agentmemory fallback journals as the canonical Source Truth ledger.
- Do not elevate REV.IKE, a model, a retrieval index, a vector projection, a dream candidate, or a sensory node into the Source Truth authority.

## 9. Source revisions at capture

- Exoskeleton `main`: `67c2d23dd8bcfcb0ce2202fe5857be213840b58b`
- Cybernetic-Ava007 `main` was inspected separately; cognitive standards and gate remediation are recorded in that repository.
- No local build, full test suite, live dual-DuckDB deployment, hardware benchmark, or production memory migration was executed as part of this documentation capture.


## 10. Whole-system optimization decision update — 2026-11-05

The detailed engineering contract is now [System Memory Source of Truth and Whole-System Optimization Contract](SYSTEM_MEMORY_SOURCE_OF_TRUTH_AND_OPTIMIZATION_2026-11-05.md). It is the required working reference for all subsequent memory-system implementation and benchmark work.

- DuckDB 2.0.0 LTS is the current schema target identified by `schema_20.sql`; schema execution and exact server/Wasm version compatibility still require runtime proof.
- Arrow is an optional interchange adapter, not a required memory tier or assumed hot-path dependency. Retain, replace, or remove it only after identical-workload comparison against native DuckDB ingestion and other valid paths.
- DuckDB's native Quack client/server protocol is distinct from this application's outbox/apply mechanism (`quack_outbox`, `quack_sync.ts`, `quack_apply.ts`). Evaluate possible transport simplification without weakening offline-first semantics.
- Optimize the complete observation-to-durable-ledger-to-retrieval-to-decision lifecycle. Report copies, allocations, boundary ownership, latency distributions, throughput, memory, durability, recovery and retrieval quality.
- This update does not certify builds, schema execution, end-to-end zero-copy, benchmark performance or production readiness.
