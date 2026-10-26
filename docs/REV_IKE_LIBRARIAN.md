# REV.IKE — Headless Librarian

**Role:** Librarian agent for the Exoskeleton long-term memory chassis.  
**Execution model:** Headless, identity-aware, operates in place.

## Principles (Tailscale / Aperture aligned)

- **Identity first.** Authentication and authorization flow from Tailscale identity. No shared long-lived API keys are distributed to the agent.
- **Operate in place.** Files and memory stay on the machines that own them. The Librarian does not copy corpora into a hosted workspace.
- **Gateway ready.** LLM traffic and tool calls are intended to route through an Aperture-style gateway so credentials and policy stay outside the agent process.
- **Least privilege.** Grants control what the Librarian may read, curate, or materialize.

## Responsibilities

1. Ingest high-rate telemetry and transition events via the zero-copy streaming path.
2. Curate the long-term chassis (create / merge / prune transition structures).
3. Maintain the anticipatory workspace that downstream agents navigate.
4. Expose only the minimal surface required for short-term isolates and presentation consumers.

## Current Foundation

- Zero-copy sequential intake pipeline (ported and modernized).
- Local SQLite staging for intake durability (temporary; migrates to DuckDB Server / DuckLake).
- Directory layout for L0 trace, atom, and reference offload streams.

## Target Structure

```
packages/librarian/
  src/
    agent.ts          # headless entry, identity bootstrap
    intake.ts         # zero-copy streaming engine
    curator.ts        # create / merge / delete / stop operations
    workspace.ts      # anticipatory filesystem / molecule view
    grants.ts         # capability surface for Aperture
```

## Non-Responsibilities

- Cognitive reasoning or intent classification
- Direct possession of provider API keys
- Ownership of short-term Wasm isolates
- Rendering or GPU work
