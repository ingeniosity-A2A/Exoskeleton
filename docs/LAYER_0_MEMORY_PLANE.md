# Layer 0 — SharedVectorMailbox

**Status:** Implemented (v2 sound kernel)  
**Path:** `packages/substrate-native/src/memory_plane.rs`

## Soundness rules

1. Slots are **never freed** — fixed ring, recycle by generation (prevents UAF).
2. `(payload, generation)` published as one unit via **seqlock** on the slot.
3. **Single publisher** thread (ingestion worker); debug assert enforces.
4. Readers **copy under seqlock**; torn reads retry, never delivered.

## Scope

- Coordinates **threads in one address space** (`std::sync::atomic`).
- Cross-process: use existing `/dev/shm` ring — not this module.
- Progress guarantee: **lock-free** (not wait-free). Runtime `is_lock_free` assert in `init()`.

## Memory model

- Publisher: seqlock write section + `active.store(..., Release)`.
- Reader: `Relaxed` load of active + `fence(Acquire)` (C++20 [atomics.fences] synchronizes-with Release).
- Reference: https://doc.rust-lang.org/std/sync/atomic/

## Compression ladder (corrected)

| Format | 768-dim size |
|--------|-----------------|
| 4-bit pack | 384 B |
| BF16 | 1,536 B |
| f32 | 3,072 B |
| f64 | 6,144 B |

## Next integration

Wasm/Rust → DuckDB Arrow binding: mailbox payload stream → `arrow_ingest` → `turboquant_blocks` → triggers → Quack outbox. Prefer this over presentation bindings for correctness closure.
