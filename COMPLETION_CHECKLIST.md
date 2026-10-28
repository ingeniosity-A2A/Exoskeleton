# Exoskeleton — Completion Checklist

**Last updated:** 2026-10-28

## Implemented on main (code)

- [x] schema_20 + Quack + Dream-RSI + rubric engine
- [x] Layer 0 mailbox v2 + napi_bridge
- [x] REV.IKE intake/curator/grants
- [x] **Capability layer** — registry, `sense.audio`, compose-harness (Grok Build pattern)
- [x] Docs: CAPABILITY_LAYER.md (catalog vs registry; Appendix B fit)

## Still missing (runtime / evidence)

- [ ] DuckDB 2.0 install + schema_20 both engines **[M]**
- [ ] `pnpm install` lock under catalog 2.0 **[M]**
- [ ] `cargo test` substrate-native **[M]**
- [ ] Wire real Audex or Dynamo backend into `sense.audio` (mock ships)
- [ ] napi → Omnibus JS
- [ ] Quack kill/resync **[M]**
- [ ] E2E capability invoke → ledger grade **[M]**
- [ ] Ava-007 attach to chassis **[M]**
