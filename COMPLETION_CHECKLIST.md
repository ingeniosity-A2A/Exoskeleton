# Exoskeleton — Completion Checklist

**Repository:** ingeniosity-A2A/Exoskeleton  
**Last updated:** 2026-10-26

Items move to Done only when evidence is recorded in `docs/VALIDATION.md`.

## Authority & Language

- [x] Dual-instance topology documented (Ava-007 DuckDB + Exoskeleton DuckDB/Wasm)
- [x] Server framed as product of Ava-007 ↔ Exoskeleton requirements
- [x] REV.IKE keeps his name; librarian = task functions only
- [x] Schema v3.2 patches applied (generation column, skill ledger, WAL cursor)
- [x] pnpm catalog corrected (semver ranges, both duckdb engines)

## Memory Chassis

- [x] DDL for molecules, atomic_tweens (+ generation), codebooks, skill ledger, WAL cursor
- [x] MVCC latest-wins transition commit surface
- [ ] Schema applied and verified against live DuckDB
- [ ] Zero-copy Arrow materialization path
- [ ] Quack / remote attach surface for Ava-007 instance

## REV.IKE

- [x] Zero-copy intake foundation
- [x] Intake / curator / grants module surface
- [ ] Curator actions fully implemented
- [ ] Identity wired to real Tailscale/Aperture subject
- [ ] Skill compiler package (Rust) integrated

## Package & Supply Chain

- [x] pnpm workspace + catalog present
- [ ] Lockfile regenerated under approved pnpm 12.x
- [ ] Dependabot / update path configured

## Validation

- [ ] docs/VALIDATION.md has dated command evidence
- [ ] Acceptance harness for skill compile + ledger commit (reported → measured)
