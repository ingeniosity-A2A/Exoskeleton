# Exoskeleton — Completion Checklist

**Last updated:** 2026-10-27  
**Source of truth:** DuckDB 2.0 system review (implemented)

Items move to Done only with evidence in `docs/VALIDATION.md`.

## Implemented (code on main)

- [x] schema_20.sql (triggers, outbox, VARIANT, turboquant_blocks, generation)
- [x] CognitiveState + atomToRow
- [x] HolographicTemporalEngine (TemporalSubstrate)
- [x] TwinEngineMatrix ingress gate
- [x] QuackOutbox + QuackNativeTransport + QuackApply
- [x] arrow_ingest (arena → turboquant_blocks)
- [x] GLSL ease (backOut, spinodal)
- [x] pnpm catalog lockstep duckdb + @duckdb/duckdb-wasm ^2.0.0
- [x] REV.IKE naming + dual-instance topology docs

## Missing to complete Exoskeleton

### Runtime / migration
- [ ] Upgrade both engines to DuckDB 2.0 and apply schema_20 on Wasm + server
- [ ] Migrate any pre-2.0 ledgers (one-way format)
- [ ] Expose Quack HTTP endpoint on 1b (`-serve`); point QuackNativeTransport
- [ ] Regenerate pnpm-lock.yaml under catalog 2.0 and verify install

### FFI / Rust substrate
- [ ] Recompile Rust FFI with `ava_codes_view` header export (dim, bit_width)
- [ ] Wire napi binding for arrow_ingest
- [ ] skill_compiler.rs package integration (if still required under this stack)

### REV.IKE functions
- [ ] Curator actions fully implemented against schema_20
- [ ] Identity subject wired to Tailscale/Aperture
- [ ] Grants enforced on materialize / serve paths

### Validation (hardware / harness)
- [ ] C2 device sweep → trace.jsonl
- [ ] Test 5 index-scale
- [ ] shader_decode_ms profiling into trace
- [ ] Acceptance: skill compile round-trip + ledger commit/recovery harness
- [ ] docs/VALIDATION.md dated command evidence for each claim

### Omnibus consumer
- [ ] Omnibus skill-ledger action reconciled to schema_20 column types
- [ ] Ava-007 cognitive DuckDB attach path verified end-to-end
