# Exoskeleton — Completion Checklist

**Last updated:** 2026-10-27

## Implemented on main

- [x] schema_20 + Quack triggers/outbox/apply
- [x] CognitiveState, TemporalSubstrate (rate Mc), TwinEngineMatrix
- [x] Layer 0 mailbox v2 (seqlock, no UAF)
- [x] mailbox_ingest (UINT4 header + publish/snapshot)
- [x] arrow_ingest.ingestMailboxSnapshot
- [x] Discrepancy ledger + critical review findings closed in docs
- [x] VECTOR_CORE.md turbovec seam

## Missing to complete Exoskeleton

### Runtime / migration
- [ ] DuckDB 2.0 both engines; apply schema_20; migrate pre-2.0
- [ ] Quack HTTP + kill/resync dual-engine test
- [ ] pnpm-lock under catalog 2.0

### Native / FFI
- [ ] `cargo test -p exoskeleton-substrate-native` on host + AArch64
- [ ] napi/Wasm export: snapshot_for_ingest → JS MailboxSnapshot
- [ ] Pin turbovec git dep; wire encode → publish_packed_block
- [ ] Measured compression / distance claims → VALIDATION.md

### REV.IKE
- [ ] Curator on schema_20
- [ ] Tailscale/Aperture identity + grants

### Validation
- [ ] End-to-end: Layer 0 publish → ingest → outbox → apply watermark
- [ ] C2 sweep, shader_decode_ms, index-scale → trace.jsonl
- [ ] docs/VALIDATION.md dated evidence

### Omnibus / Ava-007
- [ ] Skill-ledger schema_20 types
- [ ] Cognitive DuckDB attach E2E
