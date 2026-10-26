# Exoskeleton

**Long-term memory chassis and Librarian substrate for Ava-007.**

This repository owns Layer 1b of the Twin-Engine DuckDB State Fabric and the headless Librarian agent (REV.IKE).

```
AVA-007 TWIN-ENGINE DUCKDB STATE FABRIC

Layer 1a  In-process short-term memory (DuckDB Wasm isolate)
          Owned by the cognitive runtime — not this repository

Layer 1b  Core chassis long-term memory (DuckDB Server / DuckLake)
          Owned here — global columnar ledger, bitpacked Parquet,
          MVCC WAL, TurboVecQuant materialization

Layer 4   Presentation plane (GPU uniform blocks / PBO)
          Consumes zero-copy streams produced by this chassis
```

## Status

Bootstrap → Foundation.  
Only claims backed by recorded command output in `docs/VALIDATION.md` are made.

## What this repository owns

| Owns | Does not own |
|------|--------------|
| Layer 1b long-term memory (DuckDB Server / DuckLake) | Layer 1a short-term Wasm isolate |
| REV.IKE Librarian (headless, identity-aware) | Cognitive reasoning / intellect |
| Zero-copy streaming intake and materialization | GPU presentation shaders |
| Transition-law schema (`atomic_tweens`, codebooks) | Device / modem / browser stacks |

## REV.IKE — The Librarian

REV.IKE is the headless Librarian agent.  
He curates the long-term memory chassis, operates in place, and follows Tailscale/Aperture identity principles:

- No shared API keys
- Operates on data where it lives
- Identity flows from the tailnet
- Ready for Aperture gateway and MCP connectors

See `packages/librarian/` and `docs/REV_IKE_LIBRARIAN.md`.

## Package management

- **pnpm only** (pinned in `package.json`)
- Workspace declared in `pnpm-workspace.yaml`
- Dependency update path documented in `docs/PNPM_WORKSPACE_POLICY.md`
- Lockfile is the reproducibility contract

## Completion tracking

See `COMPLETION_CHECKLIST.md` for remaining work required to bring this repository to production readiness.
