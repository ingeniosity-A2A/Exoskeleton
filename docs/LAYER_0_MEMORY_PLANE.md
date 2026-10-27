# Layer 0 — SharedVectorMailbox

**Status:** v2 sound kernel + mailbox→DuckDB binding  
**Paths:**
- `packages/substrate-native/src/memory_plane.rs`
- `packages/substrate-native/src/mailbox_ingest.rs`

## Critical review — resolved

| Finding | Resolution |
|---------|------------|
| UAF via post-swap free | Fixed ring; slots never freed |
| Torn (ptr, gen) | Generation in slot header; seqlock publishes as one unit |
| Bare pointer API | `acquire_snapshot_copy` + unsafe raw with revalidation contract |
| Wait-free claim | Corrected to **lock-free**; `is_lock_free` assert in `init` |
| Processes vs threads | Scope = threads in one address space; cross-process = /dev/shm |
| BF16 size | 768×2 = **1,536 B** (not 6,144) |

## Soundness rules

1. Slots never freed — generation ring recycle  
2. (payload, generation) via seqlock  
3. Single publisher (debug assert)  
4. Readers copy under validated seqlock bracket  

## Binding

`publish_packed_block` / `snapshot_for_ingest` carry `dim` + `bit_width` in a 4-byte header so Arrow/DuckDB materialization does not guess layout.
