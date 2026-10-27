# Exoskeleton — Completion Checklist

**Last updated:** 2026-10-27

## Implemented on main

- [x] schema_20 (incl. skill_rubrics + rubric ledger columns)
- [x] CognitiveState / TemporalSubstrate / TwinEngineMatrix / Quack / arrow_ingest
- [x] Layer 0 mailbox v2 + mailbox_ingest + napi_bridge C ABI
- [x] PrismaCoder rubric_engine (evalScore, gateRoute, informativeness)
- [x] REV.IKE curator (createMolecule, purge, registerRubric, grants)
- [x] VALIDATION.md measured-vs-reported dock

## Still missing (runtime / evidence)

- [ ] DuckDB 2.0 install + schema_20 apply both engines + migrate
- [ ] `cargo test` substrate-native on CI/host + AArch64
- [ ] napi/Wasm package wiring ava_mailbox_* into JS Omnibus
- [ ] turbovec crate pin + encode → publish_packed_block
- [ ] Quack HTTP serve on 1b + kill/resync test [M]
- [ ] pnpm-lock under catalog 2.0
- [ ] Tailscale/Aperture real subject injection (grants code ready)
- [ ] E2E: publish → ingest → outbox → apply [M]
- [ ] Rubric vs holistic A/B on live traces [M]
- [ ] Omnibus skill-ledger writes rubric columns
- [ ] Ava-007 cognitive DuckDB attach [M]
