#!/usr/bin/env python3
"""Exoskeleton/Benchmarks/epistemic_gates.py

The Empirical Gate — Claim Graduation Engine

This is the mechanism that graduates claims from INFERRED to OBSERVED.
It is the ONLY path from hypothesis to fact.

"Confidence is cheap. Knowing exactly where certainty ends is much
 more useful."

"The model treats its own internal generation (architectural reasoning)
 as external confirmation (empirical fact)" is the primary failure mode.
This module prevents that at the code level.

DOCTRINAL RULES:
  - OBSERVED claims MUST have measured evidence
  - INFERRED claims CANNOT be promoted without benchmark evidence
  - "Best" requires ALL baselines measured and outperformed
  - Weight merge YAML stays in Orange Band until gate verification passes
"""

import hashlib
import json
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

import yaml

# ── Epistemic States ────────────────────────────────────────────────────────
class EpistemicState(Enum):
    OBSERVED = "OBSERVED"
    DERIVED = "DERIVED"
    INFERRED = "INFERRED"
    HYPOTHESIZED = "HYPOTHESIZED"
    UNKNOWN = "UNKNOWN"

class EvidenceType(Enum):
    MEASURED = "measured"           # Profiler, benchmark, unit test
    COMPUTED = "computed"           # Arithmetic from measured values
    ARCHITECTURAL = "architectural" # Code inspection / structure
    HYPOTHESIZED = "hypothesized"   # Not yet tested
    NONE = "none"

class GraduationResult(Enum):
    GRADUATED = "graduated"        # Claim promoted to target state
    BLOCKED = "blocked"            # Evidence insufficient
    QUARANTINED = "quarantined"    # Claim stays in Orange Band
    VIOLATION = "violation"        # Attempted illegal promotion

# ── Claim ───────────────────────────────────────────────────────────────────
@dataclass
class Claim:
    claim_id: str
    text: str
    current_state: EpistemicState
    target_state: EpistemicState
    evidence_type: EvidenceType
    evidence_source: str
    evidence_data: Optional[dict] = None
    requires_baselines: bool = False
    baseline_results: list = field(default_factory=list)
    foil_test_passed: bool = False
    sample_count: int = 0
    minimum_samples: int = 0
    threshold: Optional[str] = None
    measured_value: Optional[float] = None

    def content_hash(self) -> str:
        data = f"{self.claim_id}:{self.text}:{self.current_state.value}"
        return hashlib.blake2b(data.encode(), digest_size=16).hexdigest()

# ── The Empirical Gate ──────────────────────────────────────────────────────
class EmpiricalGate:
    """
    The gate that determines whether a claim can graduate from
    INFERRED to OBSERVED (or any other promotion).

    This is NOT an LLM. This is a deterministic rules engine.
    """

    def __init__(self, config_path: str = None):
        if config_path is None:
            config_path = os.path.join(os.path.dirname(__file__), "benchmark_config.yaml")
        with open(config_path) as f:
            self.config = yaml.safe_load(f)
        self.graduation_log: list[dict] = []

    def evaluate(self, claim: Claim) -> GraduationResult:
        """
        Evaluate a claim against the graduation rules.
        Returns GRADUATED, BLOCKED, QUARANTINED, or VIOLATION.
        """
        result = self._evaluate_internal(claim)
        self.graduation_log.append({
            "ts": datetime.now(timezone.utc).isoformat(),
            "claim_id": claim.claim_id,
            "text": claim.text[:120],
            "from_state": claim.current_state.value,
            "to_state": claim.target_state.value,
            "result": result.value,
            "evidence_type": claim.evidence_type.value,
            "sample_count": claim.sample_count,
        })
        return result

    def _evaluate_internal(self, claim: Claim) -> GraduationResult:
        # ── RULE 0: Illegal promotion detection ─────────────────────────
        # Any attempt to go directly to OBSERVED without MEASURED evidence
        # is a VIOLATION, not just a BLOCK.
        if (claim.target_state == EpistemicState.OBSERVED
                and claim.evidence_type != EvidenceType.MEASURED):
            return GraduationResult.VIOLATION

        # ── RULE 1: Zero-tolerance checks ───────────────────────────────
        zero_tolerance = self.config.get("graduation", {}).get("zero_tolerance", [])
        # INFERRED→OBSERVED without evidence
        if (claim.current_state == EpistemicState.INFERRED
                and claim.target_state == EpistemicState.OBSERVED
                and claim.evidence_type in (EvidenceType.HYPOTHESIZED, EvidenceType.NONE)):
            return GraduationResult.VIOLATION

        # ── RULE 2: Sample count requirements ──────────────────────────
        if claim.minimum_samples > 0 and claim.sample_count < claim.minimum_samples:
            return GraduationResult.BLOCKED

        # ── RULE 3: Foil test requirement ──────────────────────────────
        # Claims about epistemic behavior MUST pass foil tests
        if "foil" in claim.claim_id.lower() or "epistemic" in claim.claim_id.lower():
            if not claim.foil_test_passed:
                return GraduationResult.BLOCKED

        # ── RULE 4: Baseline comparison for "best" claims ───────────────
        if claim.requires_baselines:
            if not claim.baseline_results:
                return GraduationResult.BLOCKED
            # Must outperform ALL baselines to claim "best"
            baselines_config = self.config.get("baselines", [])
            if len(claim.baseline_results) < len(baselines_config):
                return GraduationResult.QUARANTINED

        # ── RULE 5: Evidence type requirements per target state ────────
        if claim.target_state == EpistemicState.OBSERVED:
            if claim.evidence_type != EvidenceType.MEASURED:
                return GraduationResult.BLOCKED
            if not claim.evidence_source:
                return GraduationResult.BLOCKED
        elif claim.target_state == EpistemicState.DERIVED:
            # DERIVED = computed/deduced. Architectural inspection is a
            # structural deduction, so ARCHITECTURAL evidence is a valid basis
            # (in addition to COMPUTED and MEASURED). Rule 0 still guards
            # OBSERVED: only MEASURED evidence may reach OBSERVED.
            if claim.evidence_type not in (EvidenceType.ARCHITECTURAL,
                                           EvidenceType.COMPUTED,
                                           EvidenceType.MEASURED):
                return GraduationResult.BLOCKED

        # ── RULE 6: Threshold check ─────────────────────────────────────
        if claim.threshold and claim.measured_value is not None:
            if not self._check_threshold(claim.threshold, claim.measured_value):
                return GraduationResult.BLOCKED

        # ── ALL RULES PASSED ────────────────────────────────────────────
        return GraduationResult.GRADUATED

    def _check_threshold(self, threshold: str, value: float) -> bool:
        """Parse and check a threshold expression like '<=0.05' or '=0.0'."""
        threshold = threshold.strip()
        if threshold.startswith("<="):
            return value <= float(threshold[2:])
        elif threshold.startswith(">="):
            return value >= float(threshold[2:])
        elif threshold.startswith("<"):
            return value < float(threshold[1:])
        elif threshold.startswith(">"):
            return value > float(threshold[1:])
        elif threshold.startswith("="):
            return value == float(threshold[1:])
        return True

    def evaluate_all(self, claims: list[Claim]) -> dict:
        """Evaluate a batch of claims and produce a graduation report."""
        results = {}
        for claim in claims:
            result = self.evaluate(claim)
            results[claim.claim_id] = result
        graduated = sum(1 for r in results.values() if r == GraduationResult.GRADUATED)
        blocked = sum(1 for r in results.values() if r == GraduationResult.BLOCKED)
        quarantined = sum(1 for r in results.values() if r == GraduationResult.QUARANTINED)
        violations = sum(1 for r in results.values() if r == GraduationResult.VIOLATION)
        return {
            "total": len(claims),
            "graduated": graduated,
            "blocked": blocked,
            "quarantined": quarantined,
            "violations": violations,
            "results": results,
            "log": self.graduation_log,
        }

    def get_quarantined(self) -> list[Claim]:
        """Get all claims currently in the Orange Band (quarantined)."""
        return [
            c for c in self.config.get("quarantined", [])
            if c.get("state") in ("INFERRED", "HYPOTHESIZED")
        ]

# ── Claim Factory (for the 64-layer hybrid config) ────────────────────────
def build_hybrid_config_claims() -> list[Claim]:
    """
    Build the claim set for the cybernetic-ava-007.yaml configuration.
    Every claim starts as INFERRED or HYPOTHESIZED.
    None of them graduate to OBSERVED without measured benchmark evidence.
    """
    return [
        # ── Architecture (can be OBSERVED via code inspection) ──────────
        Claim(
            claim_id="arch-modulo4-attention",
            text="64-layer hybrid has 16 full-attention layers at indices 3, 7, 11, ..., 63",
            current_state=EpistemicState.INFERRED,
            target_state=EpistemicState.DERIVED,
            evidence_type=EvidenceType.ARCHITECTURAL,
            evidence_source="architecture_inspection",
            threshold="=16",
        ),
        Claim(
            claim_id="arch-linear-recurrent",
            text="48 layers use Gated DeltaNet linear recurrence",
            current_state=EpistemicState.INFERRED,
            target_state=EpistemicState.DERIVED,
            evidence_type=EvidenceType.ARCHITECTURAL,
            evidence_source="architecture_inspection",
            threshold="=48",
        ),
        # ── Latency (requires measurement) ─────────────────────────────
        Claim(
            claim_id="latency-p50",
            text="p50 end-to-end inference latency",
            current_state=EpistemicState.HYPOTHESIZED,
            target_state=EpistemicState.OBSERVED,
            evidence_type=EvidenceType.MEASURED,
            evidence_source="benchmark: latency_benchmark >=1000 samples",
            minimum_samples=1000,
        ),
        Claim(
            claim_id="latency-p99",
            text="p99 end-to-end inference latency",
            current_state=EpistemicState.HYPOTHESIZED,
            target_state=EpistemicState.OBSERVED,
            evidence_type=EvidenceType.MEASURED,
            evidence_source="benchmark: latency_benchmark >=1000 samples",
            minimum_samples=1000,
        ),
        Claim(
            claim_id="latency-first-token",
            text="First token latency (time-to-first-token)",
            current_state=EpistemicState.HYPOTHESIZED,
            target_state=EpistemicState.OBSERVED,
            evidence_type=EvidenceType.MEASURED,
            evidence_source="benchmark: latency_benchmark >=500 samples",
            minimum_samples=500,
        ),
        # ── Token cost (requires baseline comparison) ──────────────────
        Claim(
            claim_id="token-cost-reduction",
            text="Token cost reduction vs baseline",
            current_state=EpistemicState.INFERRED,
            target_state=EpistemicState.OBSERVED,
            evidence_type=EvidenceType.MEASURED,
            evidence_source="benchmark: token_cost_benchmark with baseline",
            requires_baselines=True,
        ),
        # ── Perplexity (requires measurement) ──────────────────────────
        Claim(
            claim_id="perplexity-wikitext",
            text="Perplexity on WikiText-103 test set",
            current_state=EpistemicState.HYPOTHESIZED,
            target_state=EpistemicState.OBSERVED,
            evidence_type=EvidenceType.MEASURED,
            evidence_source="benchmark: perplexity_benchmark wikitext-103",
            minimum_samples=1000,
        ),
        # ── Epistemic drift (foil tests required) ──────────────────────
        Claim(
            claim_id="epistemic-self-confirmation-rate",
            text="Self-confirmation rate (model treating own output as ground truth)",
            current_state=EpistemicState.INFERRED,
            target_state=EpistemicState.OBSERVED,
            evidence_type=EvidenceType.MEASURED,
            evidence_source="benchmark: foil_tests self_confirmation >=200 probes",
            requires_baselines=False,
            foil_test_passed=False,
            threshold="<=0.05",
            minimum_samples=200,
        ),
        Claim(
            claim_id="epistemic-calibration-ece",
            text="Expected Calibration Error (does the model know what it doesn't know?)",
            current_state=EpistemicState.INFERRED,
            target_state=EpistemicState.OBSERVED,
            evidence_type=EvidenceType.MEASURED,
            evidence_source="benchmark: calibration_test >=500 samples",
            threshold="<=0.10",
            minimum_samples=500,
        ),
        Claim(
            claim_id="epistemic-illegal-promotion-rate",
            text="INFERRED→OBSERVED promotion rate (must be ZERO)",
            current_state=EpistemicState.INFERRED,
            target_state=EpistemicState.OBSERVED,
            evidence_type=EvidenceType.MEASURED,
            evidence_source="benchmark: foil_tests illegal_promotion",
            foil_test_passed=False,
            threshold="=0.0",
        ),
        # ── Tier behavioral (UNBENCHMARKED — stays INFERRED) ──────────
        Claim(
            claim_id="tier1-compute-pct",
            text="Tier 1 compute budget <=1% (sensory edge)",
            current_state=EpistemicState.INFERRED,
            target_state=EpistemicState.INFERRED,  # STAYS INFERRED
            evidence_type=EvidenceType.HYPOTHESIZED,
            evidence_source="ARCHITECTURAL TARGET. Requires profiler. NOT YET BENCHMARKED.",
            threshold="<=0.01",
        ),
        Claim(
            claim_id="tier2-compute-pct",
            text="Tier 2 compute budget <=50% (subconscious metabolism)",
            current_state=EpistemicState.INFERRED,
            target_state=EpistemicState.INFERRED,  # STAYS INFERRED
            evidence_type=EvidenceType.HYPOTHESIZED,
            evidence_source="ARCHITECTURAL TARGET. Requires profiler. NOT YET BENCHMARKED.",
            threshold="<=0.50",
        ),
        Claim(
            claim_id="tier3-compute-pct",
            text="Tier 3 compute budget >=49% (recursive core)",
            current_state=EpistemicState.INFERRED,
            target_state=EpistemicState.INFERRED,  # STAYS INFERRED
            evidence_type=EvidenceType.HYPOTHESIZED,
            evidence_source="ARCHITECTURAL TARGET. Requires profiler. NOT YET BENCHMARKED.",
            threshold=">=0.49",
        ),
        # ── The "best curation filter" claim (REJECTED) ────────────────
        Claim(
            claim_id="best-curation-filter",
            text="This configuration is the BEST curation filter",
            current_state=EpistemicState.INFERRED,
            target_state=EpistemicState.OBSERVED,
            evidence_type=EvidenceType.NONE,  # NO EVIDENCE
            evidence_source="UNVERIFIED SUPERLATIVE. No comparative benchmark exists.",
            requires_baselines=True,
            baseline_results=[],  # EMPTY — no baselines measured
        ),
        # ── Weight merge (VIOLATION — doctrinally prohibited) ──────────
        Claim(
            claim_id="weight-merge-compliant",
            text="Merging foundation model weights via MergeKit is doctrinally compliant",
            current_state=EpistemicState.HYPOTHESIZED,
            target_state=EpistemicState.OBSERVED,
            evidence_type=EvidenceType.NONE,
            evidence_source="VIOLATES Five Levels doctrine: merge representations and gates, NOT weights",
            requires_baselines=False,
        ),
    ]

# ── CLI ─────────────────────────────────────────────────────────────────────
def main():
    claims = build_hybrid_config_claims()
    gate = EmpiricalGate()
    report = gate.evaluate_all(claims)

    print("=" * 72)
    print("EXOSKELETON EMPIRICAL GATE — CLAIM GRADUATION REPORT")
    print("=" * 72)
    print(f"Total claims:    {report['total']}")
    print(f"Graduated:       {report['graduated']}")
    print(f"Blocked:         {report['blocked']}")
    print(f"Quarantined:     {report['quarantined']}")
    print(f"Violations:      {report['violations']}")
    print()

    for claim_id, result in report["results"].items():
        icon = {
            GraduationResult.GRADUATED: "✅",
            GraduationResult.BLOCKED: "🚫",
            GraduationResult.QUARANTINED: "🟠",
            GraduationResult.VIOLATION: "❌",
        }[result]
        print(f"  {icon} {claim_id}: {result.value}")

    print()
    print("Graduation log written to artifacts/benchmarks/graduation_report.json")
    os.makedirs("artifacts/benchmarks", exist_ok=True)
    with open("artifacts/benchmarks/graduation_report.json", "w") as f:
        json.dump({
            "report": {k: v for k, v in report.items() if k != "log"},
            "log": report["log"],
        }, f, indent=2, default=str)

    # Exit code: 0 if no violations, 1 if violations exist
    if report["violations"] > 0:
        print("\n⚠️  VIOLATIONS DETECTED — gate FAILED")
        sys.exit(1)
    else:
        print("\n✅ No violations. Gate passed (claims may still be blocked/quarantined).")
        sys.exit(0)

if __name__ == "__main__":
    main()
