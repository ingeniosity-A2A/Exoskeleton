# Vector Core — turbovec integration seam

**Reference:** https://github.com/RyanCodrai/turbovec  
**Layer 0 path:** `packages/substrate-native`  
**Materialization:** `packages/memory-chassis/src/data/arrow_ingest.ts`

## Pipeline

```
RAW embedding
  → turbovec: RaBitQ scale → Block-Hadamard → Lloyd-Max → UINT4/UINT2
  → publish_packed_block(mailbox, gen, dim, bit_width, codes)
  → snapshot_for_ingest (seqlock-validated copy)
  → ingestMailboxSnapshot → turboquant_blocks
  → schema triggers → quack_outbox → QuackApply (1b)
```

## Compression ladder (corrected)

| Format | 768-dim |
|--------|---------|
| 4-bit | 384 B |
| BF16 | 1,536 B |
| f32 | 3,072 B |
| f64 | 6,144 B |

## Hybrid retrieval

- **turbovec:** length renormalization + compressed similarity
- **Timeline:** exact temporal scrubbing on `start_time_ms` axis

KNN is not discarded; it is hybrid with temporal index.

## Status

- [x] Payload header (dim, bit_width) with codes
- [x] Mailbox publish + snapshot API
- [x] TS ingest of generation-consistent snapshots
- [ ] turbovec crate pin in Cargo.toml
- [ ] napi/Wasm export of snapshot_for_ingest
- [ ] Measured MSE / SIMD distance vs FAISS baseline in VALIDATION.md
