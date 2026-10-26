# REV.IKE

**Name:** REV.IKE (unchanged).  
**Task functions:** librarian-style intake, normalization, curation, grant-gated serve.

“Librarian” describes what he does. It is not a rename.

## Role

REV.IKE operates on the Exoskeleton chassis:

- Zero-copy intake of raw streams
- Normalization into structured records the chassis can materialize
- In-place curation (create / merge / delete / stop workspace operations)
- Identity-aware, grant-gated access (Tailscale / Aperture aligned)

He does not perform cognitive reasoning. He does not hold provider API keys.

## Principles

- Operate in place — data stays where it lives
- Identity first — no shared long-lived API keys
- Gateway-ready — LLM and tool traffic intended for Aperture-style routing
- Least privilege — grants control read / curate / materialize

## Package surface

`packages/librarian/` — intake, curator, grants modules under REV.IKE’s function set.
