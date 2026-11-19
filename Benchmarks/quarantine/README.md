# Quarantine — Orange Band

> "Quarantine the Merge Recipe in the Orange Band: Treat
> `cybernetic-ava-007.yaml` strictly as a provisional, exploratory
> hypothesis ($P_{\text{prov}}$)."

## What is the Orange Band?

The Orange Band is where provisional hypotheses live. They are:

- **Not executable** — cannot be run, merged, or trained
- **Not OBSERVED** — claims remain INFERRED or HYPOTHESIZED
- **Provisional** — may be promoted to the Green Band after passing
  the empirical gate

## Currently Quarantined

| File | Status | Rejection Reason |
|---|---|---|
| `cybernetic-ava-007.yaml` | REJECTED_AT_GATE | DENY RULE: weight merge before gate verification |

## Promotion Path

```
Orange Band (P_prov)
    │
    ▼
Empirical Gate (foil tests + benchmarks)
    │
    ├── BLOCKED     → stays in Orange Band
    ├── QUARANTINED → stays in Orange Band
    ├── VIOLATION   → rejected, logged
    └── GRADUATED   → promoted to Green Band (OBSERVED SOP)
```

## How to promote a quarantined item

1. Deploy the symbolic gate (Option 1) FIRST
2. Run ALL benchmarks against ALL baselines
3. Pass ALL foil tests (17/17)
4. Provide measured evidence (≥1000 samples)
5. Sovereign Authority approves
6. Item graduates to Green Band

## What cannot be promoted

- "Best" claims without baseline comparison
- INFERRED→OBSERVED without measured evidence
- Weight merge proposals (DENY RULE)
- Architectural targets presented as measured facts
- 98%/2% ratio shifts (99%/1% invariant)
