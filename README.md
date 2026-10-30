# Exoskeleton

**Substrate chassis for Ava-007.**

Ava-007 has a DuckDB. Exoskeleton has a DuckDB (Wasm via Rust substrate). The **server** path is the product of requirements between the two instances.

**Repo:** https://github.com/ingeniosity-A2A/Exoskeleton  
**Supersedes:** `A2A-Exoskeleton` (sunset / archive)

## Layout

```
packages/memory-chassis/   schema_20, Quack, TwinEngine, Dream-RSI, rubric, Arrow ingest
packages/substrate-native/ Layer 0 SharedVectorMailbox + C ABI
packages/librarian/        REV.IKE intake/curator/grants (TS)
engine/rev_ike.py          Zero-copy intake engine (fail-closed from TS)
docs/                      Authority, validation, discrepancy, vector core
```

## Dual-instance fabric

```
Ava-007 DuckDB  ←→  Exoskeleton DuckDB (Wasm + server path)
                         │
                         ▼
                   REV.IKE (intake / curation functions)
```

## Package management

- **pnpm only** — see `pnpm-workspace.yaml` catalog (DuckDB 2.0 lockstep)
- Apply `packages/memory-chassis/src/schema_20.sql` on **both** engines before first write

## Operator completion

See `docs/OPERATOR_RUNBOOK.md` and `COMPLETION_CHECKLIST.md`.  
Claims stay **[R]** until dated evidence is in `docs/VALIDATION.md`.

## REV.IKE naming

Name is **REV.IKE**. Canonical role, principles and package surface: `docs/REV_IKE.md`. Task functions only: `docs/REV_IKE_LIBRARIAN.md`.

## Lineage

Derived from `a2a-exoskeleton` (archived reference). Reference points: `main` at `f6e363f`; `pnpm/12.10.0-readiness` at `91012c7`; `chore/pnpm-12-repository-local-store` at `fe829ab`.

Decide before copying anything (owner):

- [ ] Which old content is still current
- [ ] Where Rev.ike belongs (old docs disagree)
- [ ] Whether TurboVec and the GSAP kernel are integrated here or stay in forged-ai-filing-os
- [x] Which pnpm version is current — resolved 2026-10-30: the repo pins **pnpm 9.15.0**; the current upstream release is **12.16.1**. The old `12.10.0` vs `12.14.0` question is superseded. Upgrade procedure and caveats live in `docs/PNPM_WORKSPACE_POLICY.md`.
