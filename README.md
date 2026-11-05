# Exoskeleton

**Exoskeleton is the runtime and execution substrate in the current Ava007 framework.** It supplies the infrastructure that turns authorized intent and capability requests into managed execution: lifecycle orchestration, memory/data movement, capability contracts, observability, interruption, recovery, and release.

This repository is the canonical home for Exoskeleton implementation and its internal subsystem **Rev.Ike**.

## Framework boundaries

| System | Responsibility | Exoskeleton relationship |
|---|---|---|
| **Cybernetic-Ava007** | Governing intelligence, purpose, reasoning authority, model/intelligence composition | Exoskeleton receives authorized intent; it does not own Ava007's identity or governing objective |
| **Exoskeleton** | Runtime substrate, orchestration, memory/data plane, capability lifecycle, Rev.Ike, telemetry and execution evidence | This repository |
| **Ava007 Omni Operating System (Omni-OS)** | Operating environment: Linux/mobile edge, devices, networking, containers, compute, browser and hardware interfaces | Exoskeleton requests environment capabilities through contracts; Omni-OS owns the environment |
| **MA Computing** | A2A documentation and A2A-specific architectural/protocol material | A2A documents belong there, not in this repository |

**A2A Exoskeleton is obsolete.** Do not describe the current Exoskeleton as an A2A Exoskeleton, A2A hub, A2A protocol owner, or A2A architecture. A2A documentation is owned by MA Computing.

## Rev.Ike

Rev.Ike belongs to Exoskeleton. It is an internal subsystem for intake, normalization, curation, provenance and grant-gated materialization/serving. Its function set does not make it the owner of Ava007's governing intelligence or a separate framework authority.

Canonical role: `docs/REV_IKE.md`. Task functions: `docs/REV_IKE_LIBRARIAN.md`.

## Repository layout

```
engine/rev_ike.py                 Rev.Ike intake engine
packages/substrate-native/        Native memory plane and mailbox
packages/memory-chassis/          Memory/data chassis, DuckDB, Quack, vector and temporal integration
packages/librarian/               Rev.Ike TypeScript function surface
packages/capabilities/            Capability contracts, registry and composition
docs/                             Exoskeleton-owned technical documentation
```

## Operating principles

1. **Authority separation:** Exoskeleton executes; Cybernetic-Ava007 owns governing intelligence; Omni-OS owns the operating environment; MA Computing owns A2A documentation.
2. **Contract-first execution:** discover, validate, select, allocate, execute, observe, interrupt/reverse where supported, and release.
3. **Explicit ownership:** Rev.Ike is an Exoskeleton subsystem. Do not relocate its ownership to Ava007 or MA Computing.
4. **Evidence before claims:** code presence is not runtime verification. Validation entries remain `[R]` until dated command output and environment details establish `[M]`.
5. **No false zero-copy claims:** identify and measure each boundary independently. Any copy/materialization means the complete path is not end-to-end zero-copy.
6. **Preserve provenance:** retain source, version, revision, grants, transformations and validation evidence for ingested or curated artifacts.

## Build and validation

Package manager: pnpm, pinned by the root `package.json`. Follow `docs/PNPM_WORKSPACE_POLICY.md`; do not assume a target version has been installed or validated.

See `docs/OPERATOR_RUNBOOK.md`, `COMPLETION_CHECKLIST.md` and `docs/VALIDATION.md`. No test, benchmark, deployment or integration is considered complete without recorded evidence.

## Superseded terminology

- Do not use **A2A Exoskeleton** as the current system name.
- Do not place A2A protocol documentation in this repository; MA Computing owns it.
- Do not describe Rev.Ike as an independent authority or as the owner of Ava007 cognition.
- Do not conflate the Exoskeleton runtime substrate with the Omni-OS operating environment.
