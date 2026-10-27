# Exoskeleton — Completion Checklist

**Last updated:** 2026-10-27  
**HEAD family:** includes Dream-RSI, rubric engine, Layer 0 v2, intake fail-closed

## Implemented on main (code)

- [x] schema_20 (tweens, Quack outbox/triggers, skill ledger, rubrics, dream_sessions)
- [x] CognitiveState / TemporalSubstrate / TwinEngineMatrix
- [x] quack_sync / quack_apply / arrow_ingest
- [x] Dream-RSI (`dream_rsi.ts` + schema tables)
- [x] PrismaCoder rubric_engine
- [x] Layer 0 mailbox v2 + mailbox_ingest + napi_bridge C ABI
- [x] REV.IKE curator / grants / intake→rev_ike.py (no zero stub)
- [x] Docs: fabric, Layer 0, vector core, discrepancy, PrismaCoder, validation dock

## Still missing (runtime / evidence on your host)

- [ ] DuckDB 2.0 install + schema_20 apply both engines + migrate
- [ ] `pnpm install` lockfile proof under catalog 2.0
- [ ] `cargo test` / `cargo build --release` substrate-native
- [ ] napi/Wasm wire `ava_mailbox_*` into Omnibus JS (or Rust-bin measurement only)
- [ ] turbovec pin (optional until in-crate encode needed)
- [ ] Quack HTTP 1b + kill/resync **[M]**
- [ ] E2E publish → ingest → outbox → apply **[M]**
- [ ] Intake JSON report **[M]**
- [ ] Tailscale/Aperture live subject (code ready)
- [ ] Rubric vs holistic A/B on live traces **[M]**
- [ ] Ava-007 cognitive DuckDB attach **[M]**
