# Memory subsystem feed — integration and verification record

Date: 2026-11-05
Target: `ingeniosity-A2A/Exoskeleton`, default branch `main`

## Scope and repository mapping

The feed supplied the following implementation units: DuckDB schema, Layer-0 mailbox, packed-code arena/FFI, cognitive-state types, GSAP temporal engine/easing, DuckDB transactional ingress, Quack outbox and apply, Arrow ingestion, Dream-RSI replay, and a server-side skill-execution gate.

The current Exoskeleton repository contains the memory chassis under `packages/memory-chassis` and the native substrate under `packages/substrate-native`. It does **not** contain the feed's `apps/omnibus` application tree. The Omnibus-only files (`CognitiveState.ts`, `TemporalSubstrate.ts`, `TwinEngineMatrix.ts`, `quack_sync.ts`, `quack_apply.ts`, `arrow_ingest.ts`, `dream_rsi.ts`, easing module, and server action) therefore must be ported to the owning application repository or added only after that application boundary is established. They must not be silently placed into a different package with unresolved `@/infra` imports.

## Changes made in this commit

1. `packages/substrate-native/src/memory_plane.rs`
   - Replaced the ordinary byte array accessed concurrently through raw pointers with `AtomicU8` storage.
   - Replaced the stored raw active-slot pointer with an atomic slot index, avoiding an internal pointer that could become stale if the mailbox value moves.
   - Serialized publishers in all builds, not only debug builds.
   - Retained bounded snapshot-copy retries and generation validation.
   - Removed the raw zero-copy pointer escape hatch. An atomic-byte mailbox cannot safely expose its payload as a plain `*const u8`; a future GPU zero-copy path needs an explicit pinned/leased buffer ownership protocol.

2. `packages/substrate-native/src/packed_codes_ffi.rs`
   - Added a native packed-code arena implementation.
   - Made the header 64-byte aligned and sized, so the first payload block starts at a 64-byte boundary.
   - Added checked size arithmetic, capacity enforcement, pointer validation, and null-return error signaling at the C ABI boundary.
   - Documented the lifetime and immutability requirements of borrowed views.

3. `packages/substrate-native/src/lib.rs`
   - Exported the new packed-code arena module and type.

## Feed items not represented as application runtime code in this repository

The following feed paths are application-specific and are not present in the current Exoskeleton tree:

- `apps/omnibus/src/infra/types/CognitiveState.ts`
- `apps/omnibus/src/infra/kernel/TemporalSubstrate.ts`
- `apps/omnibus/src/infra/data/TwinEngineMatrix.ts`
- `apps/omnibus/src/infra/data/quack_sync.ts`
- `apps/omnibus/src/infra/data/quack_apply.ts`
- `apps/omnibus/src/infra/data/arrow_ingest.ts`
- `apps/omnibus/src/infra/dream/dream_rsi.ts`
- `apps/omnibus/src/infra/easing/cahn-hilliard-ease.js`
- `apps/omnibus/src/actions/ledger.ts`

The repository's corresponding package-level modules are under `packages/memory-chassis/src`, but they are not byte-for-byte equivalents of the feed. They require coordinated API and schema changes, plus typechecking and runtime tests, before the feed's Omnibus implementation can be claimed as integrated.

## Known defects still requiring a separate verified patch

- `schema_20.sql` currently sources trigger generation from a session setting rather than the row's `orchestrator_generation_id`; outbox records also need a stable `tween_id`.
- The current Quack snapshot path does not perform authoritative per-molecule replacement, so stale destination rows can survive a resync.
- Current Quack row decoding is position-based, not column-name-based, and the source outbox lacks the identity field needed for deterministic replay.
- Current DuckDB ingress opens the connection before entering its cleanup `try/finally`, and interpolates values into SQL rather than binding parameters.
- Current temporal transition persistence is fire-and-forget; persistence failure can leave runtime state ahead of the durable ledger.
- Current Dream-RSI needs strict validation of vector hit IDs/scores, candidate arrays, simulator output indices, and finite score values before persisting or returning a candidate.
- Arrow arena ingestion must use the actual Wasm memory exported by the FFI module and must not assume that a native process pointer is a Wasm linear-memory offset.
- The server action in the feed depends on Omnibus-specific modules and is not part of this repository's current package surface.

## Verification status

This commit corrects the Layer-0 Rust data-race and pointer-stability defects and adds the aligned arena implementation. It does not establish a complete end-to-end memory subsystem release. No claim of full TypeScript integration, DuckDB 2.0 schema execution, replica convergence, GPU zero-copy, or production readiness is made by this document.

Required validation before release: Rust unit tests and Miri/concurrency review; native/Wasm ABI lifetime tests; DuckDB 2.0 schema and trigger tests on both server and Wasm engines; TypeScript typecheck; Quack replay/snapshot convergence tests; Arrow memory ownership tests; and Dream-RSI invalid-input/falsification tests.
