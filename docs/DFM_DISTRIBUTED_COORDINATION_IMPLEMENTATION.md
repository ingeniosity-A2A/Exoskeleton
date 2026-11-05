# DFM and Distributed Coordination — Exoskeleton Implementation Notes

**Status:** Experimental source code present; build and test status unverified.  
**Runtime owner:** Exoskeleton. Cognitive authority and promotion authorization remain with AVA-007.

## Added Rust modules

| Module | Scope actually implemented | Not implemented |
|---|---|---|
| `dfm_parametric.rs` | Chunk input validation, score/depth admission, cosine-similarity deduplication, ADD/UPDATE decision and in-memory registry | Learned causal predictor, embedding projector, gated cross-attention, model inference, durable ledger adapter |
| `superiorization.rs` | Deterministic candidate selection subject to positive safety margin, retained-margin fraction and generation check | Full superiorization algorithm, convex feasibility solver, Lyapunov/FAPO integration, convergence proof |
| `consensus.rs` | One weighted-neighbor update with confidence and generation filtering | Paper-specific fixed-point update, graph/mixing-matrix handling, asynchronous protocol, quasi-Fejér proof |
| `ota_computation.rs` | Weighted mean/min/max over digital packets already received | Physical OTA-C, analog waveform superposition, synchronization, channel estimation or RF error model |

## Authority and durability

The DFM registry is an in-memory staging primitive. It does not write Source Truth. Callers must persist accepted decisions through the authorized ledger path and retain provenance, reviewer, generation, content digest and decision audit. REV.IKE remains read-only and cannot promote memory or authorize execution.

## Validation

Tests are included in each module but have not been run in this change. Run:

```sh
cargo test --manifest-path packages/substrate-native/Cargo.toml
```

Do not mark these modules production-ready until the command succeeds on the target toolchain and integration tests cover persistence, concurrency, stale data, invalid vectors, graph partitions and policy safety. The validation dock remains the authority for measured evidence.
