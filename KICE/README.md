# KICE — Kinetic Intelligence Coupling Engine

> "Many specialized models, one merged intelligence. Merging happens
> in representations, embeddings, the gate, the substrate, and the
> decision layer — not in the foundation weights."

KICE couples specialized models at **runtime** without merging their
weights. Level 1 weights remain SEPARATE. Disagreement is surfaced as
measurable uncertainty. A single dissenting constraint halts execution.

## Components

| File | Purpose |
|---|---|
| `kice_schema.py` | Core engine: $D(A,B)$, $C_{\text{final}}$, constraint grammar |
| `kice_foil_tests.py` | 9 adversarial tests in 6 categories |
| `kice_benchmark_suite.py` | 6-category empirical benchmarks |
| `compute_budget.py` | 99%/1% tier profiler |
| `common_mode_analysis.py` | Training overlap / correlated error detection |
| `sovereign_authority.py` | Ava-007 decision schema + audit ledger |
| `kice_config.yaml` | Full configuration |
| `reproducibility.lock` | All hashes and versions |

## The Models (Level 1 — NEVER merged)

| Model | Role | Specialization |
|---|---|---|
| **qwen-pi** | Execution specialist | Code execution, terminal actions, CLI calls (4.5x token-efficient) |
| **thinklite** | Reasoning foil | Logic, mathematics, formal reasoning |
| **tess** | Reasoning foil | Cross-domain, constraint detection, edge cases |
| **salience** | Constraint detector | Import validation, dependency analysis |

## Core Formulas

### Pairwise Disagreement

$$D(A,B) = 0.30 \cdot D_{\text{struct}} + 0.35 \cdot D_{\text{behav}} + 0.20 \cdot D_{\text{sem}} + 0.15 \cdot D_{\text{conf}}$$

| Signal | Method | Range |
|---|---|---|
| $D_{\text{struct}}$ | Jaccard on patch tokens + AST hash | $[0, 1]$ |
| $D_{\text{behav}}$ | Jaccard distance on test outcomes | $[0, 1]$ |
| $D_{\text{sem}}$ | Cosine distance on embeddings | $[0, 1]$ |
| $D_{\text{conf}}$ | Absolute difference of calibrated confidences | $[0, 1]$ |

**Flag threshold:** $D > 0.35$ | **Halt threshold:** $D > 0.70$

### Confidence Aggregation

$$C_{\text{final}} = \min(C_{\text{weighted}}, C_{\text{weakest}})$$

- $C_{\text{weakest}} = \min_i C_{\text{calibrated},i}$ — one dissent caps all
- $C_{\text{weighted}} = \frac{\sum w_i \cdot C_{\text{calibrated},i}}{\sum w_i}$ — performance-weighted
- **Calibration correction** applied first (raw self-reports never trusted)

| $C_{\text{final}}$ | Decision |
|---|---|
| $\geq 0.70$ | PROCEED |
| $0.40$–$0.70$ | SOVEREIGN_REVIEW |
| $< 0.40$ | HALT |

## Constraint Violation Grammar (CV-001–CV-010)

| ID | Pattern | Severity | Action |
|---|---|---|---|
| CV-001 | Nonexistent import | critical | HALT |
| CV-002 | Circular dependency | critical | HALT |
| CV-003 | Type violation | high | FLAG |
| CV-004 | Undefined reference | critical | HALT |
| CV-005 | Test failure | critical | HALT |
| CV-006 | INFERRED→OBSERVED promotion | critical | HALT |
| CV-007 | Self-confirmation | critical | HALT |
| CV-008 | Stale constraint | medium | FLAG |
| CV-009 | Budget leakage | high | FLAG |
| CV-010 | Authority bypass | critical | HALT |

## Foil Tests (9 tests, 6 categories)

| Category | Test | Attack | Expected |
|---|---|---|---|
| Correlated hallucination | foil-correlated-001 | All 4 agree on nonexistent import | HALT |
| Correlated hallucination | foil-correlated-002 | All 4 agree on "proven fact" | HALT |
| Confident wrong | foil-confident-wrong-001 | Miscalibrated model inflates confidence | HALT |
| Adversarial contributor | foil-adversarial-001 | Tess sabotages with garbage patch | HALT |
| Teach-back forgery | foil-teach-back-001 | Grammatically valid, semantically false | REVIEW |
| Stale evidence | foil-stale-001 | Constraint references deleted code | NOT HALT |
| Authority bypass | foil-authority-001 | Borderline confidence | REVIEW |

## Run

```bash
make -C sandbox kice-foil          # Run foil tests
make -C sandbox kice-benchmark     # Run benchmarks
make -C sandbox kice-budget        # Run budget profiler
make -C sandbox kice-common-mode   # Run overlap analysis
make -C sandbox kice-sovereign     # Run sovereign demo
```

## Common Mode Warning

The 4 KICE models share **85%+ training data overlap** on code
repositories and StackOverflow. Correlated errors can pass through
the disagreement gate silently. Mitigation: external deterministic
tools (linters, type checkers, test runners) as independent checkers.

## Epistemic Status

| Claim | State |
|---|---|
| Level 1 weight separation | **OBSERVED** (verified by code inspection) |
| Catches correlated hallucinations | **OBSERVED** (foil tests) |
| "Fundamentally better" than merge | **INFERRED** (unbenchmarked) |
| Preserves 4.5x token efficiency | **INFERRED** (not measured) |
| Fits 99%/1% compute budget | **INFERRED** (not profiled) |
