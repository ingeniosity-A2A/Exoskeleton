# Capability Layer (Manifesto-aligned)

**Authority:** The Exoskeleton Upgrade · Appendix B · External Alignment Addendum v0.1  
**Rule (main paper §6):** Model calls a capability **by name** and receives a **uniform observation**. It never learns whether the implementation was a function, a coding harness, or a world model.

## pnpm catalog ≠ capability registry

| Mechanism | Purpose |
|-----------|---------|
| **pnpm catalog** | Single source of truth for **dependency versions** (`duckdb`, `gsap`, …) in `pnpm-workspace.yaml` |
| **Capability registry** | Single source of truth for **named abilities** the model may invoke (`sense.audio`, `code.resolve`, `robot_act`) |

Do **not** merge these. Catalogs prevent version drift. Registries prevent tool sprawl and orchestration overhead.

## Singular composed capability

Skills, tools, and multi-step harnesses collapse to **one** capability name:

```
Model ──invoke("sense.audio")──► CapabilityRegistry
                                      │
                                      ▼
                              [ ASR | TTS | Audex | Dynamo speech ]
                                      │
                                      ▼
                              CapabilityObservation { ok, data, latencyMs }
```

### Headless sensory node — `sense.audio`

- Modes: understand · transcribe · speak · generate · dialog
- Backend: pluggable (`mock` default; Audex 2B/30B-A3B or Dynamo `/v1/audio/speech`)
- Audex remains active on Hugging Face (Nemotron-Labs-Audex collection) — valuable intelligence **behind** the capability, not substrate

### Grok Build pattern — `composeHarnessCapability`

Appendix B: Grok Build is a **reference** for wrapping a multi-step harness as one capability — **not** a template for the substrate. See `compose_harness.ts` / `code.resolve` example.

## External fit (Appendix B + 2026 updates)

| Technology | Fit | Layer |
|------------|-----|--------|
| **Audex** (active HF) | Audio I/O intelligence | Capability backend for `sense.audio` |
| **Grok Build** | Multi-step coding harness | Wrap as one composed capability |
| **Cosmos 3 Edge** | On-device world model | Candidate behind `robot_act()` |
| **Vera Rubin** | Rack-scale overhead removal | Hardware **precedent** for thesis — not software substrate |
| **MotionBricks** | Real-time motion primitives | Physical / motion capability composition metaphor |
| **GSAP** | Temporal ticker / ease | Already in TemporalSubstrate (chassis presentation) |
| **LTX upscaler** | Visualization only | Out of control loop |

## Stack

```
Ava-007  →  Exoskeleton substrate  →  Capability layer
                                      ├─ sense.audio     (sensory)
                                      ├─ code.resolve    (composed harness)
                                      ├─ robot_act()     (physical — future)
                                      └─ tool/*          (thin tools as needed)
```

Package: `packages/capabilities`
