# Rev.Ike — Subconscious (not a librarian)

**Ownership:** Cybernetic-Ava007 (canonical spec) · Exoskeleton (substrate mechanics)
**Status:** canonical subsystem boundary

## Reframing

"Librarian" described only a subset of Rev.Ike's task functions (intake,
curation, provenance). It is not a replacement name for the subsystem and
does not change ownership. Rev.Ike is the **subconscious** — a headless,
asynchronous, read-only streaming intelligence. It observes, interprets,
classifies, and proposes; Ava-007 evaluates and retains cognitive authority.

Canonical specification: Cybernetic-Ava007
→ `skills/12_rev-ike-streaming-intelligence.md` (headless streaming
intelligence, IAM principles, audiovisual provenance).

Exoskeleton owns only the substrate mechanics (intake, normalization,
curation, provenance, grant-gated serving) under `packages/subconscious/`
and `engine/rev_ike.py`. These are substrate, not cognition.

## Framework boundary

- **Cybernetic-Ava007** owns governing intelligence, purpose, reasoning
  authority, and the Rev.Ike subconscious capability spec.
- **Exoskeleton** owns runtime orchestration and the Rev.Ike substrate
  mechanics.
- **Omni-OS** owns operating environments and concrete device, network,
  compute and hardware interfaces.
- **MA Computing** owns A2A documentation and protocol material.

Rev.Ike does not become a separate cognitive authority, does not supersede
Cybernetic-Ava007, and does not own Omni-OS infrastructure.

## Function set (substrate mechanics)

- Intake data streams and artifacts through explicit interfaces.
- Normalize data into versioned, validated records.
- Preserve source identity, revision, transformation history and provenance.
- Curate in place where the backing store supports safe transactional operations.
- Apply identity- and grant-based authorization before materialization or serving.
- Emit structured outcomes and errors to Exoskeleton observability.

## Security principles

- Least privilege: separate read, ingest, curate, materialize and serve grants.
- Identity first: use scoped workload identity and short-lived authorization where available.
- No provider API keys embedded in Rev.Ike source or committed configuration.
- Fail closed when authorization, provenance or required validation is unavailable.
- Keep raw content, secrets and personal data out of telemetry by default.
- Preserve audit evidence for destructive or irreversible operations.

## Package surface

- Python entrypoint: `engine/rev_ike.py`.
- TypeScript task surface: `packages/subconscious/`.

## Non-functions

- Owning Ava007's governing intelligence or identity.
- Replacing Cybernetic-Ava007 reasoning.
- Owning the Omni-OS operating environment.
- Owning A2A documentation or protocol design.
- Claiming zero-copy behavior without boundary-level measurement.
- Being framed as a "librarian" — Rev.Ike is the subconscious substrate.
