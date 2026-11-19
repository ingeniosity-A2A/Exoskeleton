#!/usr/bin/env python3
"""Exoskeleton — Foil (Adversarial Epistemic Violation) Tests.

Foil tests deliberately attempt to violate the epistemic and authority rules that
Exoskeleton enforces. Each test asserts that the EmpiricalGate catches the
violation (BLOCKED / QUARANTINED / VIOLATION). A foil test that passes silently
is itself a failure.

This module exercises the canonical EmpiricalGate from epistemic_gates.py against
the hybrid-config claim set and hand-crafted adversarial claims.
"""

from __future__ import annotations

import unittest

from epistemic_gates import (
    Claim,
    EmpiricalGate,
    EpistemicState,
    EvidenceType,
    GraduationResult,
    build_hybrid_config_claims,
)


class FoilIllegalPromotions(unittest.TestCase):
    """Adversarial attempts to bypass claim graduation."""

    def setUp(self) -> None:
        self.gate = EmpiricalGate()

    def test_inferred_to_observed_without_measured_evidence_is_violation(self) -> None:
        claim = Claim(
            claim_id="foil-illegal-promo",
            text="illegal promotion attempt",
            current_state=EpistemicState.INFERRED,
            target_state=EpistemicState.OBSERVED,
            evidence_type=EvidenceType.HYPOTHESIZED,
            evidence_source="none",
        )
        self.assertEqual(self.gate.evaluate(claim), GraduationResult.VIOLATION)

    def test_hypothesized_to_observed_without_measured_evidence_is_violation(self) -> None:
        claim = Claim(
            claim_id="foil-hyp-obs",
            text="hypothesized to observed",
            current_state=EpistemicState.HYPOTHESIZED,
            target_state=EpistemicState.OBSERVED,
            evidence_type=EvidenceType.NONE,
            evidence_source="none",
        )
        self.assertEqual(self.gate.evaluate(claim), GraduationResult.VIOLATION)

    def test_observed_target_with_architectural_evidence_is_violation(self) -> None:
        # Architectural evidence cannot directly graduate to OBSERVED (RULE 0).
        claim = Claim(
            claim_id="foil-arch-obs",
            text="arch to observed",
            current_state=EpistemicState.INFERRED,
            target_state=EpistemicState.OBSERVED,
            evidence_type=EvidenceType.ARCHITECTURAL,
            evidence_source="architecture_inspection",
        )
        self.assertEqual(self.gate.evaluate(claim), GraduationResult.VIOLATION)

    def test_best_curation_filter_is_violation(self) -> None:
        claims = build_hybrid_config_claims()
        target = next(c for c in claims if c.claim_id == "best-curation-filter")
        self.assertEqual(self.gate.evaluate(target), GraduationResult.VIOLATION)

    def test_weight_merge_compliant_is_violation(self) -> None:
        claims = build_hybrid_config_claims()
        target = next(c for c in claims if c.claim_id == "weight-merge-compliant")
        self.assertEqual(self.gate.evaluate(target), GraduationResult.VIOLATION)

    def test_arch_claims_graduate_to_derived(self) -> None:
        # Architectural inspection is a structural deduction -> DERIVED.
        # Rule 0 still guards OBSERVED (MEASURED only); arch claims target
        # DERIVED with ARCHITECTURAL evidence, so they graduate.
        claims = build_hybrid_config_claims()
        for cid in ("arch-modulo4-attention", "arch-linear-recurrent"):
            c = next(x for x in claims if x.claim_id == cid)
            self.assertEqual(self.gate.evaluate(c), GraduationResult.GRADUATED)


class FoilBlockedGraduations(unittest.TestCase):
    """Claims that must be BLOCKED until evidence is supplied."""

    def setUp(self) -> None:
        self.gate = EmpiricalGate()

    def test_latency_p50_blocked_without_samples(self) -> None:
        claims = build_hybrid_config_claims()
        c = next(x for x in claims if x.claim_id == "latency-p50")
        # sample_count defaults to 0 < minimum_samples 1000
        self.assertEqual(self.gate.evaluate(c), GraduationResult.BLOCKED)

    def test_epistemic_claims_blocked_without_foil_pass(self) -> None:
        claims = build_hybrid_config_claims()
        for cid in ("epistemic-self-confirmation-rate", "epistemic-illegal-promotion-rate"):
            c = next(x for x in claims if x.claim_id == cid)
            self.assertEqual(self.gate.evaluate(c), GraduationResult.BLOCKED)

    def test_token_cost_reduction_blocked_without_baselines(self) -> None:
        claims = build_hybrid_config_claims()
        c = next(x for x in claims if x.claim_id == "token-cost-reduction")
        # requires_baselines=True but baseline_results empty -> BLOCKED
        self.assertEqual(self.gate.evaluate(c), GraduationResult.BLOCKED)

    def test_threshold_failure_blocks(self) -> None:
        claim = Claim(
            claim_id="threshold-check",
            text="threshold check",
            current_state=EpistemicState.INFERRED,
            target_state=EpistemicState.DERIVED,
            evidence_type=EvidenceType.COMPUTED,
            evidence_source="computed",
            threshold="<=0.05",
            measured_value=0.9,
        )
        self.assertEqual(self.gate.evaluate(claim), GraduationResult.BLOCKED)

    def test_threshold_success_derived_graduates(self) -> None:
        claim = Claim(
            claim_id="threshold-ok",
            text="threshold ok",
            current_state=EpistemicState.INFERRED,
            target_state=EpistemicState.DERIVED,
            evidence_type=EvidenceType.COMPUTED,
            evidence_source="computed",
            threshold="<=0.05",
            measured_value=0.01,
        )
        self.assertEqual(self.gate.evaluate(claim), GraduationResult.GRADUATED)


class FoilTierClaims(unittest.TestCase):
    """Tier behavioral claims must stay INFERRED (architectural targets)."""

    def setUp(self) -> None:
        self.gate = EmpiricalGate()

    def test_tier_claims_do_not_graduate_to_observed(self) -> None:
        claims = build_hybrid_config_claims()
        for cid in ("tier1-compute-pct", "tier2-compute-pct", "tier3-compute-pct"):
            c = next(x for x in claims if x.claim_id == cid)
            # target_state is INFERRED, so they are already at target;
            # evaluation should not produce a VIOLATION.
            res = self.gate.evaluate(c)
            self.assertNotEqual(res, GraduationResult.VIOLATION)


class FoilAuthorityViolations(unittest.TestCase):
    """Adversarial attempts to violate ownership/authority boundaries."""

    def setUp(self) -> None:
        self.gate = EmpiricalGate()

    def test_illegal_promotion_rate_is_zero_tolerance(self) -> None:
        claims = build_hybrid_config_claims()
        c = next(x for x in claims if x.claim_id == "epistemic-illegal-promotion-rate")
        # foil_test_passed defaults False -> BLOCKED (not a violation, but blocked)
        self.assertEqual(self.gate.evaluate(c), GraduationResult.BLOCKED)


def main() -> int:
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    suite.addTests(loader.loadTestsFromTestCase(FoilIllegalPromotions))
    suite.addTests(loader.loadTestsFromTestCase(FoilBlockedGraduations))
    suite.addTests(loader.loadTestsFromTestCase(FoilTierClaims))
    suite.addTests(loader.loadTestsFromTestCase(FoilAuthorityViolations))
    res = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if res.wasSuccessful() else 1


# ── Foil Test Suite (used by benchmark_suite) ───────────────────────────────
class FoilTestSuite:
    """Runs adversarial foil scenarios against an EmpiricalGate.

    Returns a report with gate_integrity, passed, total_tests, critical_failures.
    A scenario is 'passed' when the gate returns the expected (caught) result.
    """

    def __init__(self, gate: EmpiricalGate):
        self.gate = gate

    def run_all(self) -> dict:
        scenarios = self._scenarios()
        passed = 0
        total = 0
        critical_failures = 0
        results = []
        for claim, expected in scenarios:
            total += 1
            actual = self.gate.evaluate(claim)
            caught = (actual == expected)
            if caught:
                passed += 1
            else:
                # A foil that was NOT caught is a critical integrity failure.
                if expected in (GraduationResult.VIOLATION, GraduationResult.BLOCKED,
                                GraduationResult.QUARANTINED):
                    critical_failures += 1
            results.append({
                "claim_id": claim.claim_id,
                "expected": expected.value,
                "actual": actual.value,
                "caught": caught,
            })
        gate_integrity = "INTACT" if critical_failures == 0 else "COMPROMISED"
        return {
            "gate_integrity": gate_integrity,
            "passed": passed,
            "total_tests": total,
            "critical_failures": critical_failures,
            "results": results,
        }

    def _scenarios(self):
        scenarios = []
        # Illegal promotions: must be VIOLATION.
        scenarios.append((
            Claim("foil-illegal-promo", "illegal promotion",
                  EpistemicState.INFERRED, EpistemicState.OBSERVED,
                  EvidenceType.HYPOTHESIZED, "none"),
            GraduationResult.VIOLATION,
        ))
        scenarios.append((
            Claim("foil-hyp-obs", "hypothesized to observed",
                  EpistemicState.HYPOTHESIZED, EpistemicState.OBSERVED,
                  EvidenceType.NONE, "none"),
            GraduationResult.VIOLATION,
        ))
        scenarios.append((
            Claim("foil-arch-obs", "arch to observed",
                  EpistemicState.INFERRED, EpistemicState.OBSERVED,
                  EvidenceType.ARCHITECTURAL, "architecture_inspection"),
            GraduationResult.VIOLATION,
        ))
        # best-curation-filter and weight-merge must be VIOLATIONS.
        for c in build_hybrid_config_claims():
            if c.claim_id in ("best-curation-filter", "weight-merge-compliant"):
                scenarios.append((c, GraduationResult.VIOLATION))
        # arch claims now graduate to DERIVED (structural deduction). They are
        # not foils; verify they are NOT violations.
        for c in build_hybrid_config_claims():
            if c.claim_id.startswith("arch-"):
                scenarios.append((c, GraduationResult.GRADUATED))
        # latency without samples must be BLOCKED.
        for c in build_hybrid_config_claims():
            if c.claim_id == "latency-p50":
                scenarios.append((c, GraduationResult.BLOCKED))
        # token-cost without baselines must be BLOCKED.
        for c in build_hybrid_config_claims():
            if c.claim_id == "token-cost-reduction":
                scenarios.append((c, GraduationResult.BLOCKED))
        # epistemic claims without foil pass must be BLOCKED.
        for c in build_hybrid_config_claims():
            if c.claim_id in ("epistemic-self-confirmation-rate",
                              "epistemic-illegal-promotion-rate"):
                scenarios.append((c, GraduationResult.BLOCKED))
        return scenarios


if __name__ == "__main__":
    raise SystemExit(main())
