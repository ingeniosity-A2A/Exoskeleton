# Memory subsystem patch status — 2026-11-05

Target branch: `main`

This is a code-change ledger, not a release certification. The feed's application paths under `apps/omnibus` are not present in this repository. Equivalent package-level memory-chassis modules were updated where a corresponding module exists.

## Committed source changes

| Feed subsystem | Exoskeleton path | Change |
|---|---|---|
| DuckDB ledger/outbox | `packages/memory-chassis/src/schema_20.sql` | Outbox now records `tween_id`; triggers use the row's `orchestrator_generation_id`, not a session setting; explicit `tween_blocks` provenance relation added. |
| Layer 0 mailbox | `packages/substrate-native/src/memory_plane.rs` | Atomic byte storage, active slot index instead of stored pointer, all-build publisher serialization, validated copy snapshots. |
| Packed arena / FFI | `packages/substrate-native/src/packed_codes_ffi.rs` | Added aligned arena and checked C ABI surface. |
| Native module exports | `packages/substrate-native/src/lib.rs` | Exported packed arena module/type. |
| Cognitive state mapping | `packages/memory-chassis/src/types/CognitiveState.ts` | One ledger row per numeric property; validates identifiers, generation, timing, and finite values. |
| Temporal engine | `packages/memory-chassis/src/kernel/TemporalSubstrate.ts` | Awaits durable persistence before starting GSAP mutation; snapshot returns a copy. |
| Transactional ingress | `packages/memory-chassis/src/data/TwinEngineMatrix.ts` | Always releases ingress gate, handles connection failures, validates numeric input, escapes SQL literals. |
| Quack outbox | `packages/memory-chassis/src/data/quack_sync.ts` | Decodes by column name, includes tween identity, supports explicit full-molecule snapshots including empty snapshots, validates acknowledgements, and exposes stop(). |
| Quack apply | `packages/memory-chassis/src/data/quack_apply.ts` | Applies batches and watermark in one transaction; replay uses tween identity; snapshot replacement deletes stale rows in its declared molecule scope. |
| Arrow/Wasm ingestion | `packages/memory-chassis/src/data/arrow_ingest.ts` | Requires explicit memory from the same Wasm instance, bounds-checks pointer range, materializes bytes before asynchronous DB calls, and requires a unique block-ID base. |
| Dream-RSI | `packages/memory-chassis/src/dream/dream_rsi.ts` | Validates vector IDs/scores, rejects invalid simulator indexes and score inputs, joins through explicit tween/block provenance, and filters execution evidence by capability class. |
| Cahn-Hilliard easing | `packages/memory-chassis/src/easing/cahn-hilliard-ease.ts` | Added bounded gain validation and explicit registration function. |

## Not ported into this repository

The feed's `apps/omnibus/src/actions/ledger.ts` server action and its `@/infra/*` dependencies are application-owned. There is no `apps/omnibus` tree in this Exoskeleton repository. The server action must be committed to the actual Omnibus application repository after its repository identity and current source files are established; copying it here would create unresolved imports and a misleading build surface.

The original feed's `apps/omnibus` easing, types, temporal, ingress, sync, apply, Arrow, and Dream-RSI paths are likewise not present as paths in this repository. Their package-level counterparts above were updated instead.

## Remaining technical caveats

- No local Rust or TypeScript toolchain was available through the GitHub connector; these commits have not been compiled or executed in this session.
- The packed arena allocation path and all C ABI callers still require native/Wasm tests, Miri, and lifetime validation.
- The Quack protocol requires integration tests against the actual server adapter to prove duplicate delivery, partial batches, empty snapshots, stale-row deletion, and crash/restart convergence.
- The DuckDB 2.0 schema and trigger syntax must be executed against the exact Wasm and server builds before migration approval.
- Dream-RSI evidence still needs a domain-level invariant that each execution-ledger score is uniquely associated with the exact tween being replayed. The generation + capability-class join is narrower than the previous join but is not a substitute for a direct execution-to-tween foreign key.
- The mailbox intentionally no longer exposes a raw pointer into atomic-byte storage. Zero-copy GPU consumption is not claimed; it needs a pinned immutable lease or a separate non-overlapping buffer protocol.
- The ingress currently uses escaped SQL literals because the current adapter surface shown in this package does not establish a prepared-statement API contract. A bound-parameter API should replace this after confirming the concrete DuckDB-Wasm version.

## Release gate

Do not mark this subsystem production-ready until the schema, Rust, TypeScript, FFI, Quack convergence, and Dream-RSI evidence-linkage tests above are run and their output is recorded in `docs/VALIDATION.md`.
