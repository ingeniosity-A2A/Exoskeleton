# Rev.Ike Ownership Audit — Subconscious vs. Substrate

## Doctrinal position

Rev.Ike is the **subconscious** — a headless, asynchronous, read-only
streaming intelligence. It is NOT a librarian and NOT a second cognitive
actor. It observes, interprets, classifies, and proposes; Ava-007
(Cybernetic-Ava007) evaluates and retains cognitive authority.

Canonical specification lives in Cybernetic-Ava007:
→ `skills/12_rev-ike-streaming-intelligence.md` (headless streaming
intelligence, IAM principles, audiovisual provenance).

## Ownership split

| Layer | Owner | Rev.Ike content |
|---|---|---|
| Intellect / cognition | Cybernetic-Ava007 | Canonical Rev.Ike skill spec, IAM principles, audiovisual provenance, gates |
| Substrate / runtime mechanics | Exoskeleton | Intake, normalization, curation, provenance, grant-gated serving, mailbox, persistence, transport |
| Environments / devices | Omni-OS (Ava007-Omni-OS) | Device, network, compute, hardware interfaces |
| Capabilities / consoles | Agent-X | Skill execution surfaces |

## What belongs where

### Exoskeleton (substrate — keep, reframe as subconscious substrate)

- `engine/rev_ike.py` — intake substrate (rename framing from "librarian" to subconscious substrate).
- `packages/subconscious/` (renamed from `packages/librarian/`) — TypeScript task surface: curator, grants, intake. Substrate mechanics only.
- `docs/REV_IKE.md` — subsystem boundary (reframed: subconscious, not librarian).
- `docs/REV_IKE_SUBCONSCIOUS.md` — replaces the old `REV_IKE_LIBRARIAN.md`.
- `docs/MANIFESTO_GATE.md`, `docs/gates/` — structural gates (Exoskeleton owns these).

### Cybernetic-Ava007 (intellect — canonical home for Rev.Ike spec)

- `skills/12_rev-ike-streaming-intelligence.md` — canonical Rev.Ike subconscious capability spec.
- `gates/`, `bin/verify_13gates.py` — doctrinal gates and verification.
- Do NOT duplicate this spec in Exoskeleton; reference it.

### Ava007 (Omni-OS / application layer)

- `packages/amos/core/rev_ike/` — Rust crate (capability_runtime, model_router, normalize, routing).
- `docs/exoskeleton/REV.IKE-Capability.md` — capability spec (served by Ava007).
- `docs/runtime/DUAL_CONSCIOUSNESS_CONTRACT.md` — dual consciousness contract.
- These are application-layer artifacts; Exoskeleton should not duplicate them.

### A2A-Exoskeleton (legacy/substrate predecessor)

- `exoskeleton/`, `crates/`, `rust/`, `forged/` — substrate code. Some modules may be ported, but do not duplicate; prefer the canonical Exoskeleton (this repo) for new work.
- `OFFICIAL-THREE-REPO.md`, `ORGANIZATION.md` — define the three-repo split (Cybernetic-Ava007 = Intellect, a2a-exoskeleton = substrate, Agent-X = capabilities). This repo (Exoskeleton) is the successor substrate.

## Rev.Ike is NOT a librarian

The framing "Rev.Ike = librarian" was incorrect. Rev.Ike is the subconscious.
"Librarian" described only a subset of task functions (intake, curation,
provenance). The subsystem has been reframed:

- `packages/librarian/` → `packages/subconscious/`
- `docs/REV_IKE_LIBRARIAN.md` → `docs/REV_IKE_SUBCONSCIOUS.md` (removed librarian framing)
- `docs/REV_IKE.md` updated to describe Rev.Ike as the subconscious substrate.
- `engine/rev_ike.py` agent_id renamed from `librarian-rev-ike` to `subconscious-rev-ike`.

## Branches checked (no duplication)

- Cybernetic-Ava007: many branches (manifesto-gate-nine-stage, sparc/hf-feed-intake, etc.) — Rev.Ike spec is on `main` as `skills/12_rev-ike-streaming-intelligence.md`. Do not duplicate; reference.
- Ava007: branches `cleanup/remove-grok-20260928`, `pnpm/12.10.0-workspace` — no new Rev.Ike content needing port.
- A2A-Exoskeleton: only `main` — substrate predecessor; no Rev.Ike-specific code to port.
- Exoskeleton (this repo): branches merged into `main` (codex, benchmark, kinetics, backup) — all deleted.

## Do not duplicate

- Do not copy Cybernetic-Ava007's `skills/12_rev-ike-streaming-intelligence.md` into Exoskeleton; reference it.
- Do not copy Ava007's Rust crate or capability spec into Exoskeleton; it is application-layer.
- Do not reintroduce "librarian" as the name for Rev.Ike; use "subconscious".
- Do not duplicate docs/gates HTML from Exoskeleton into Cybernetic-Ava007 or vice versa; each repo owns its own gates.

## Action taken in this repo

- Renamed `packages/librarian/` → `packages/subconscious/`.
- Renamed `docs/REV_IKE_LIBRARIAN.md` → `docs/REV_IKE_SUBCONSCIOUS.md` (reframed).
- Updated `docs/REV_IKE.md` (subconscious framing).
- Updated references in `COMPLETION_CHECKLIST.md`, `docs/KINETICS_OBSERVER_EXPERIMENT_2026-11-05.md`, `docs/SYSTEM_MEMORY_SOURCE_OF_TRUTH_AND_OPTIMIZATION_2026-11-05.md`, `engine/rev_ike.py`.
- Added this audit document.
