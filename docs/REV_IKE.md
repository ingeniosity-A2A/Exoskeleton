# Rev.Ike — Subconscious Substrate

**Ownership:** Exoskeleton (substrate mechanics) · Canonical spec: Cybernetic-Ava007 (intellect)
**Status:** canonical subsystem boundary
**Role:** Subconscious — headless, asynchronous, read-only to Source Truth

## Identity and responsibility

Rev.Ike is the **subconscious** of the directed cybernetic system. It is
NOT a librarian and NOT a second cognitive actor. It is a headless streaming
subconscious substrate that observes, interprets, classifies, and proposes;
Ava-007 (Cybernetic-Ava007) evaluates and retains cognitive authority.

REV.IKE is a **capability** that Ava-007 calls, not an agent Ava-007
orchestrates. All RAG, synthesis, voice generation, and philosophical
grounding live inside the substrate. Ava-007 never sees transcripts, vector
IDs, prompt graphs, or audio generation steps — only the final structured
observation.

Canonical specification lives in the Cybernetic-Ava007 repository:
→ `skills/12_rev-ike-streaming-intelligence.md` (headless streaming intelligence, IAM principles, audiovisual provenance).

Exoskeleton owns only the **non-cognitive substrate mechanics**: intake,
normalization, curation, provenance, grant-gated materialization/serving,
mailbox, persistence, transport. These are substrate, not cognition.

## Framework boundary

- **Cybernetic-Ava007** owns governing intelligence, purpose, reasoning
  authority, and the Rev.Ike subconscious capability spec.
- **Exoskeleton** owns runtime orchestration and the Rev.Ike substrate
  mechanics (intake, normalization, curation, provenance, grant-gated serving).
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

- Python entrypoint: `engine/rev_ike.py` (intake substrate).
- TypeScript task surface: `packages/subconscious/` (curator, grants, intake).

The current source presence does not establish that every operation is
zero-copy, transactional, production-secure or end-to-end integrated.
Validate each implementation and record evidence in `docs/VALIDATION.md`.

## Non-functions

- Owning Ava007's governing intelligence or identity.
- Replacing Cybernetic-Ava007 reasoning.
- Owning the Omni-OS operating environment.
- Owning A2A documentation or protocol design.
- Claiming zero-copy behavior without boundary-level measurement.
- Being framed as a "librarian" — Rev.Ike is the subconscious substrate.
