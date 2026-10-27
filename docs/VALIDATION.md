# Validation Dock

**Protocol:** Strict Falsifiability (§2)  
**Rule:** Claims stay **[R] reported** until a dated command + output is pasted here as **[M] measured**.

## Paper-carried (PrismaCoder arXiv 2610.20538v1) — [R]

| Claim | Value | Status |
|-------|-------|--------|
| Rubric vs direct-judge (ChartMimic focused) | +6.91 points | [R] until re-measured on Ava traces |
| Krippendorff α (direct → rubric) | 0.30–0.51 → 0.86–0.92 | [R] |
| Kendall τ | 0.28–0.44 → 0.64–0.67 | [R] |

## Substrate — code present, measurement open

| Check | Example command | Status |
|-------|-----------------|--------|
| pnpm lock DuckDB 2.x | `pnpm install` | [R] |
| schema_20 Wasm | apply SQL; SHOW TABLES | [R] |
| schema_20 server | duckdb CLI or node native | [R] |
| cargo test substrate-native | `cargo test` | [R] |
| mailbox publish/snapshot | cargo test / release bin | [R] |
| intake report | `python3 engine/rev_ike.py` | [R] |
| Quack kill/resync | mid-batch kill | [R] |
| Dream-RSI determinism | same seed → same path_id | [R] |
| Rubric gatekeeper zero | fail exec → eval_score 0 | [R] |

## Operator paste area

```
[M] <check>  YYYY-MM-DD  <command>  <result summary>
```
