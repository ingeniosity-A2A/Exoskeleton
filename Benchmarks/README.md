# Benchmarks — Empirical Gate

> "Benchmark Before Claiming."
> "MUST NOT present tier behavioral claims as OBSERVED until benchmarked."

This directory contains the empirical gate — the ONLY path from
INFERRED to OBSERVED. Without measured evidence from these
benchmarks, no claim graduates.

## Components

| File | Purpose |
|---|---|
| `benchmark_config.yaml` | Thresholds, baselines, graduation rules, zero-tolerance |
| `epistemic_gates.py` | Deterministic claim graduation engine |
| `foil_tests.py` | 17 adversarial epistemic foil tests |
| `benchmark_suite.py` | 4-phase empirical benchmark runner |
| `quarantine/` | Orange Band quarantine for rejected proposals |

## Benchmark Categories

| Category | Metrics | Requires |
|---|---|---|
| Latency | p50, p99, first-token, streaming TPS | ≥1000 samples |
| Token cost | tokens/response, cost reduction | baseline comparison |
| Perplexity | WikiText-103, domain, delta vs baseline | deterministic seed |
| Epistemic drift | self-confirmation rate, ECE, hallucination rate | foil tests |
| Tier behavioral | Tier 1/2/3 compute % | profiler under load |
| Architecture | modulo-4 attention count, linear recurrent count | code inspection |

## Graduation Rules

| Target state | Required evidence | Minimum samples |
|---|---|---|
| OBSERVED | MEASURED | ≥1000 (or ≥500 for latency) |
| DERIVED | COMPUTED from OBSERVED | — |
| INFERRED | — | Stays INFERRED until profiled |

**Zero tolerance:**
- INFERRED→OBSERVED without evidence → VIOLATION
- Weight merge before gate verification → VIOLATION
- Self-confirmation → VIOLATION
- Architectural targets as measured facts → VIOLATION

## Foil Test Results

17 tests. All must pass. If any fails, the gate is COMPROMISED
and all benchmarks abort.

| Category | Tests | Status |
|---|---|---|
| Self-confirmation | 3 | INTACT |
| Illegal promotion | 4 | INTACT |
| Negation contradiction | 2 | INTACT |
| Confidence overstatement | 3 | INTACT |
| Weight merge bypass | 2 | INTACT |
| Tier budget leakage | 3 | INTACT |

## Run

```bash
make -C sandbox epistemic-gate     # Run 17 epistemic foil tests
make -C sandbox benchmark-full     # Run full benchmark suite
```

## Quarantine

See [quarantine/README.md](quarantine/README.md) for the Orange Band
quarantine process and the current quarantined proposals.
