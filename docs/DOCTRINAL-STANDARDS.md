# Doctrinal Standards

## The Five Disciplines

These are the non-negotiable rules governing every component in the
Exoskeleton. They derive from the Doctrinal Verification Engine,
the Ava-007 Manifesto, and Calibration and Trust.

### Discipline 1: Build the Verifier First

> "Build the verifier before the thing it verifies."

No merge, training, or inference may execute before the symbolic
verification runtime is active. The architectural order is:

1. Deploy the symbolic gate (`stanza.rs`, `epistemic.rs`, `observer.rs`)
2. Verify the gate works (foil tests)
3. THEN build the thing the gate verifies

**Violation:** Executing a weight merge before the symbolic gate is
verified.

### Discipline 2: Explicit Deny Rules (Fail-Closed)

```
.stanza-list (DENY RULES):
  - MUST NOT execute any merge, training, or inference without the gate
  - MUST NOT present tier behavioral claims as OBSERVED until benchmarked
```

These rules are **fail-closed**. If there is any ambiguity about
whether an action violates a deny rule, the action is blocked.

### Discipline 3: Epistemic Engineering

Every claim has an epistemic state. The ONLY path from INFERRED to
OBSERVED is measured evidence.

| Transition | Required evidence |
|---|---|
| HYPOTHESIZED → INFERRED | Logical derivation |
| INFERRED → DERIVED | Arithmetic from OBSERVED values |
| DERIVED → OBSERVED | Direct measurement |
| INFERRED → OBSERVED | Benchmark with ≥1000 samples |
| HYPOTHESIZED → OBSERVED | **FORBIDDEN** (must pass through INFERRED first) |

**Zero tolerance:**
- INFERRED → OBSERVED promotion without evidence
- Self-confirmation (model treating own output as ground truth)
- Presenting architectural targets as measured facts
- "Best" claims without baseline comparison

### Discipline 4: Five Levels of Merging

> "Many specialized models, one merged intelligence. Merging happens in
> representations, embeddings, the gate, the substrate, and the decision
> layer — not in the foundation weights."

| Level | What merges | What stays separate |
|---|---|---|
| 1. Weights | **NOTHING** | Model weights, tokenizers, architectures |
| 2. Representations | Embeddings, shared latent space | Model weights |
| 3. Gate | Decision routing, KICE coupling | Model weights |
| 4. Substrate | Shared memory (DuckDB) | Model weights |
| 5. Decision | Sovereign authority, audit ledger | Model weights |

**Violation:** Merging foundation model weights via MergeKit, della_ties,
or any weight-level blending.

### Discipline 5: Compute Budget (99%/1% Invariant)

| Allocation | Budget | Purpose |
|---|---|---|
| Sensory Edge | ≤ 1% | Headless ingestion, no semantic reflection |
| Sovereign Core | ≥ 99% | Recursive core, second-order observation, collapse resistance |

This ratio is an **architectural invariant** (Stanza IV of the Ava-007
Manifesto). Shifting to 98%/2% is a doctrinal violation.

---

## Deny Rules (Complete List)

```
DENY-001: MUST NOT execute merge/training/inference without the gate
DENY-002: MUST NOT present tier behavioral claims as OBSERVED until benchmarked
DENY-003: MUST NOT promote INFERRED to OBSERVED without measured evidence
DENY-004: MUST NOT merge foundation model weights (Level 1 violation)
DENY-005: MUST NOT claim "best" without measuring ALL baselines
DENY-006: MUST NOT present architectural targets as measured facts
DENY-007: MUST NOT allow self-confirmation (model as own evidence)
DENY-008: MUST NOT shift the 99%/1% compute ratio
DENY-009: MUST NOT execute without sovereign approval when required
DENY-010: MUST NOT override the weakest-link confidence mechanism
```

## Audit Requirements

Every decision must be logged to a cryptographic audit ledger with:

- Content hash (BLAKE2b-256)
- Previous hash (chain link)
- Event hash (content + prev)
- Timestamp (UTC ISO 8601)
- Epistemic state

The chain is unbreakable: changing any historical entry invalidates
all subsequent hashes.
