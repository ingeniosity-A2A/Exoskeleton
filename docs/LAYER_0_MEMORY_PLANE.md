# Layer 0 — Native Memory Plane

**Scope:** Exoskeleton-owned native memory substrate  
**Source:** `packages/substrate-native/src/memory_plane.rs`, `mailbox_ingest.rs`

## Responsibility

Layer 0 provides bounded memory transport and synchronization primitives for Exoskeleton-owned runtime data. It is a runtime substrate, not a general-purpose memory authority for Cybernetic-Ava007, Omni-OS or MA Computing.

## Source-level API surface

The current source includes a shared-vector mailbox, packed-block publishing, snapshot access and a C ABI bridge. This describes source presence; it does not establish a safe concurrent implementation or completed Node/WASM integration.

## Required memory-safety invariant

Payload access must be legal under Rust's memory model. A sequence counter or seqlock-style retry loop does not, by itself, make concurrent reads and writes to non-atomic payload bytes safe. The implementation must use a sound ownership protocol such as exclusive slot ownership with reader pinning/reclamation, atomic payload representation, or another reviewed synchronization design.

Do not benchmark raw concurrent access as a production path until this invariant is established.

## Required invariants

1. No reader may access a payload while a writer can mutate or recycle it.
2. Slot reuse must not invalidate a live reader's view.
3. Generation and payload identity must be observed consistently.
4. Publisher cardinality must be enforced in release builds if the design requires a single publisher.
5. Unsafe APIs must state and uphold their complete lifetime, aliasing and synchronization contracts.
6. Every exported view must define ownership, mutability, lifetime and release behavior.
7. Cross-process sharing must be designed separately from same-process thread sharing.

## Data format

The current ingest source carries dimensionality and bit-width metadata with packed codes. Treat the binary format as a versioned contract. Validate length, dimensions, bit width, alignment and generation before materialization.

## Copy accounting

The current source path includes copies/materialization at multiple boundaries, including mailbox publication/snapshot and TypeScript/Arrow conversion. A future zero-copy design must account separately for:

- Producer → mailbox slot.
- Mailbox → native consumer.
- Native memory → Node/N-API or WASM view.
- Arrow buffer → DuckDB ingestion.
- Persistence/recovery boundaries.

A path is only zero-copy across boundaries where the consumer safely borrows the same storage without an intermediate copy. A `subarray`, pointer or shared-memory label alone does not prove this.

## Required verification

- Rust unit and concurrency tests.
- Miri or an equivalent soundness review where applicable.
- Model checking/stress testing for publication, reuse and reader lifetime.
- Release-mode publisher enforcement tests.
- Generation consistency and overwrite/recovery tests.
- Native/Node/WASM lifetime and release tests.
- Measured bytes copied, allocations, throughput and latency.

Current status: **source present; soundness and end-to-end runtime validation remain open**. See `docs/VALIDATION.md`.
