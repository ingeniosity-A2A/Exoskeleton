# PrismaCoder / PrismaForge Evaluation Integration

**Repository scope:** Exoskeleton evaluation and rubric implementation  
**Source path:** `packages/memory-chassis/src/grader/rubric_engine.ts`

## Purpose

This document records the proposed relationship between the cited PrismaCoder/PrismaForge research and the rubric-engine source in Exoskeleton. It does not claim that the paper's reported results reproduce on Ava007 or Exoskeleton workloads.

## Candidate bindings to validate

1. Rubric engine: modality and combined-score calculation; fail-closed gate behavior.
2. Ledger fields: rubric identifier, component scores and gate result.
3. Persisted rubrics: schema and migration for rubric definitions.
4. Informativeness: verify the actual implementation and its mathematical definition.
5. Routing: verify discard, resynthesize and retain transitions against tests.

## Framework boundary

Evaluation can assess outputs and execution artifacts. It does not acquire governing authority over Cybernetic-Ava007. Exoskeleton hosts runtime evaluation mechanics; Cybernetic-Ava007 remains the intelligence authority. A2A protocol documentation belongs to MA Computing.

## Evidence requirements

- Pin the paper version and code revision.
- Identify the exact dataset and evaluation split.
- Reproduce baseline and candidate metrics with confidence intervals where appropriate.
- Test fail-closed behavior and malformed rubric handling.
- Record commands, environment and results in `docs/VALIDATION.md`.

Research-reported scores remain `[R]` until independently reproduced on the stated workload.
