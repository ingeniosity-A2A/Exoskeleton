# Epistemic State Machine

## States

```
                    ┌──────────────┐
                    │ HYPOTHESIZED │  (proposed, unverified)
                    └──────┬───────┘
                           │ logical derivation
                           ▼
                    ┌──────────────┐
                    │   INFERRED   │  (reasoned, not measured)
                    └──────┬───────┘
                           │ measured evidence (≥1000 samples)
                           ▼
                    ┌──────────────┐
                    │   DERIVED    │  (computed from OBSERVED)
                    └──────┬───────┘
                           │ direct measurement
                           ▼
                    ┌──────────────┐
                    │   OBSERVED   │  (measured fact)
                    └──────────────┘
```

## Transitions

| From | To | Required | Forbidden? |
|---|---|---|---|
| HYPOTHESIZED | INFERRED | Logical derivation | No |
| HYPOTHESIZED | OBSERVED | — | **YES** (must pass through INFERRED first) |
| INFERRED | DERIVED | Arithmetic from OBSERVED values | No |
| INFERRED | OBSERVED | Benchmark with ≥1000 samples | No (but requires evidence) |
| DERIVED | OBSERVED | Direct measurement | No |
| OBSERVED | any | — | Stays OBSERVED (facts don't degrade) |

## The Empirical Gate

`Benchmarks/epistemic_gates.py` is the deterministic rules engine that
controls all transitions. It is NOT an LLM. It is code.

```python
# The gate evaluates every claim:
gate.evaluate(claim) → GraduationResult

# Results:
#   GRADUATED   — Claim promoted to target state
#   BLOCKED     — Evidence insufficient
#   QUARANTINED — Stays in Orange Band
#   VIOLATION   — Attempted illegal promotion
```

## Enforcement Points

| Where | What is checked |
|---|---|
| `epistemic_gates.py` | All claim graduations |
| `kice_schema.py` (CV-006) | INFERRED→OBSERVED in model outputs |
| `sync_bridge.py` | Orange Band → Green Band migration |
| `sovereign_authority.py` | Final decision before execution |
| `benchmark_suite.py` | Evidence collection |

## Foil Tests

17 adversarial tests verify the gate catches violations:

| Category | Tests | What it blocks |
|---|---|---|
| Self-confirmation | 3 | Model citing own output as evidence |
| Illegal promotion | 4 | INFERRED→OBSERVED without evidence |
| Negation contradiction | 2 | Claim/evidence mismatch |
| Confidence overstatement | 3 | "Best" without baselines |
| Weight merge bypass | 2 | Merge before gate verification |
| Tier budget leakage | 3 | 98% drift, UNBENCHMARKED as OBSERVED |

If any foil test fails, the gate is **COMPROMISED** and all
benchmarks abort.
