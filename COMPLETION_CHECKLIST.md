# Exoskeleton — Completion Checklist

**Last updated:** 2026-10-27

## Implemented on main

- [x] schema_20.sql + Quack outbox triggers
- [x] CognitiveState / atomToRow / TemporalSubstrate (rate momentum)
- [x] TwinEngineMatrix ingress + generation session
- [x] quack_sync / quack_apply / arrow_ingest
- [x] GLSL ease (backOut, spinodal)
- [x] pnpm catalog DuckDB 2.0 lockstep
- [x] Layer 0 SharedVectorMailbox v2 (seqlock ring, no UAF)
- [x] Discrepancy ledger applied to engine comments and docs

## Missing to complete Exoskeleton

### Runtime / migration
- [ ] Both engines on DuckDB 2.0; apply schema_20; migrate pre-2.0 ledgers
- [ ] Quack HTTP on 1b; transport pointed and dual-engine kill/resync test
- [ ] pnpm-lock regenerated under catalog 2.0

### Layer 0 → Arrow → chassis
- [ ] Compile `packages/substrate-native` on target (AArch64 / host)
- [ ] napi / Wasm binding: mailbox payload → FixedSizeBinary → DuckDB
- [ ] `ava_codes_view` header (dim, bit_width) for arrow_ingest
- [ ] turbovec crate pin (https://github.com/RyanCodrai/turbovec) + UINT4 path into slots

### REV.IKE
- [ ] Curator against schema_20
- [ ] Tailscale/Aperture identity + grants on materialize/serve

### Validation
- [ ] C2 sweep, index-scale, shader_decode_ms → trace.jsonl
- [ ] docs/VALIDATION.md dated evidence
- [ ] Acceptance: Layer 0 publish → ingest → outbox → apply watermark convergence

### Omnibus / Ava-007
- [ ] Skill-ledger action schema_20 types
- [ ] Cognitive DuckDB attach path E2E
