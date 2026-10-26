# Exoskeleton — Completion Checklist

**Repository:** ingeniosity-A2A/Exoskeleton  
**Last updated:** 2026-10-26

This checklist is the single source of remaining work. Items move to “Done” only when evidence is recorded in `docs/VALIDATION.md`.

## Authority & Language

- [x] README rewritten under Twin-Engine language only
- [x] COMPLETION_CHECKLIST.md created
- [ ] `docs/TWIN_ENGINE_DUCKDB_STATE_FABRIC.md` finalized
- [ ] `docs/REV_IKE_LIBRARIAN.md` finalized
- [ ] All residual legacy terms purged from docs and code comments

## Memory Chassis (Layer 1b)

- [ ] DuckDB Server / DuckLake schema for `research_molecules`, `atomic_tweens`, `turboquant_codebooks`
- [ ] MVCC-safe transition commit path (latest-wins conflict resolution)
- [ ] Zero-copy Arrow materialization path for TurboVecQuant buffers
- [ ] Quack / remote attachment surface for short-term isolates
- [ ] Persistence layout (Parquet + zone maps) documented and validated

## REV.IKE Librarian

- [x] Zero-copy streaming engine ported as intake foundation
- [ ] Headless agent structure aligned to Tailscale/Aperture identity model
- [ ] In-place curation tools (create / merge / delete / stop workspace operations)
- [ ] Identity and grant surface prepared for Aperture gateway
- [ ] MCP connector readiness (tools exposed through Aperture, not direct keys)
- [ ] Curated workspace output format defined and tested

## Package & Supply Chain

- [x] pnpm workspace present
- [ ] pnpm version upgraded to current approved 12.x patch and lockfile regenerated
- [ ] Real packages declared only after ownership review
- [ ] Dependabot or equivalent update path configured
- [ ] Build-script allowlist reviewed

## Validation & Evidence

- [ ] `docs/VALIDATION.md` updated with every command actually run
- [ ] Zero-copy intake benchmark re-run under new layout
- [ ] Cold-start and memory-pressure behavior measured (no fabricated numbers)

## Integration Boundaries

- [ ] Explicit contract with Layer 1a (short-term Wasm) documented
- [ ] Explicit contract with presentation plane (Layer 4) documented
- [ ] No cross-repository store sharing by implicit path
