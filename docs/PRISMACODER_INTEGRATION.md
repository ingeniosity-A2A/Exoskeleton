# PrismaCoder → a2a-grader integration

**Paper:** arXiv 2610.20538v1 (PrismaCoder / PrismaForge)  
**Code:** `packages/memory-chassis/src/grader/rubric_engine.ts`

## Bindings

1. **Rubric engine** — Eq. 2–3 modality + combined scores; gatekeeper fail → 0
2. **Ledger columns** — `rubric_id`, `s_code`, `s_vision`, `gatekeeper_pass`
3. **skill_rubrics table** — persisted JSON rubrics
4. **Informativeness U_i** — `informativeness()` for frontier session selection
5. **τ1/τ2 route** — `gateRoute()` discard / resynthesize / retain

## Not in paper

Edge deployment, DuckDB, Quack, TweenAtom — Ava substrate mapping is ours.
