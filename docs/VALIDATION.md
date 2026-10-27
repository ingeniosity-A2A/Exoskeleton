# Validation Dock

**Protocol:** Strict Falsifiability (§2)  
**Rule:** Claims stay **[R] reported** until a dated command + output is pasted here as **[M] measured**.

## Paper-carried (PrismaCoder arXiv 2610.20538v1) — [R]

| Claim | Value | Status |
|-------|-------|--------|
| Rubric vs direct-judge (ChartMimic focused) | +6.91 points | [R] until re-measured on Ava dispatch traces |
| Krippendorff α (direct → rubric) | 0.30–0.51 → 0.86–0.92 | [R] |
| Kendall τ | 0.28–0.44 → 0.64–0.67 | [R] |

## Substrate — code present, measurement open

| Check | Command (example) | Status |
|-------|-------------------|--------|
| substrate-native unit tests | `cargo test -p exoskeleton-substrate-native` | [R] pending CI host |
| schema_20 apply (Wasm) | apply SQL; `SHOW TABLES` | [R] |
| schema_20 apply (server) | same on 1b | [R] |
| Layer 0 → turboquant_blocks | publish → snapshot → ingestMailboxSnapshot | [R] |
| Quack kill/resync | mid-batch kill; watermark converges | [R] |
| Rubric gatekeeper zero | failed execution → eval_score 0 | [R] |

## Edge / S26

Paper trains on 32×H200. On-device energy and latency are **ours to measure** — no paper numbers claimed.
