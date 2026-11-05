# Exoskeleton Vector Core

**Scope:** vector representation, mailbox transport and database materialization  
**Status:** integration seam; TurboVec integration and measured quality/performance remain open

## Data path

```
embedding / source vector
        |
        v
quantize + encode (implementation and revision must be pinned)
        |
        v
publish packed block to native mailbox
        |
        v
safe, lifetime-bounded native consumer view or snapshot
        |
        v
validated Arrow/database adapter
        |
        v
DuckDB persistence and retrieval
```

The current source contains packed mailbox publication/snapshot code and TypeScript ingestion. It also contains conversion/materialization steps. This path must not be described as end-to-end zero-copy.

## Representation sizes

For a 768-dimensional vector, raw payload sizes (excluding headers, alignment and metadata) are:

| Representation | Payload size |
|---|---:|
| UINT4 packed | 384 bytes |
| BF16 | 1,536 bytes |
| FP32 | 3,072 bytes |
| FP64 | 6,144 bytes |

These are arithmetic payload sizes, not measured allocation or storage footprints.

## Retrieval

Compressed similarity and temporal indexing can be combined. Preserve exact temporal keys and define the approximation/recall contract for compressed search. Do not claim a retrieval-quality improvement without a fixed dataset, baseline and measured recall/latency.

## TurboVec

Reference: https://github.com/RyanCodrai/turbovec

The repository's intended integration seam is not proof of an integrated dependency. Pin an exact revision, build it on supported targets and validate encoding/decoding, distance error, recall and throughput against a named baseline before calling it integrated.

## Zero-copy requirements

- Establish a Rust-sound ownership and lifetime protocol before exposing borrowed payloads.
- Define buffer ownership and release behavior across native, Node and WASM.
- Avoid hex-string or JSON materialization in any path claimed to be zero-copy.
- Account for Arrow and DuckDB copies separately.
- Record all intermediate allocations and byte movement.

## Open acceptance work

- [ ] Sound concurrent mailbox ownership and lifetime protocol.
- [ ] Exact TurboVec revision and reproducible build.
- [ ] Native, Node and WASM adapter validation.
- [ ] Vector accuracy/recall tests against a named baseline.
- [ ] SIMD performance measurements on named hardware.
- [ ] End-to-end copy accounting and benchmark report.

See `docs/LAYER_0_MEMORY_PLANE.md` and `docs/VALIDATION.md`.
