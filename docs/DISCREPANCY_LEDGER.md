# Exoskeleton Discrepancy and Correction Ledger

**Purpose:** keep repository documentation aligned with the current framework and measured implementation.  
**Reviewed:** 2026-11-04

| # | Stale or unsafe statement | Current correction |
|---|---|---|
| 1 | “A2A Exoskeleton” is the current architecture | A2A Exoskeleton is obsolete. This repository is Exoskeleton; A2A documentation belongs to MA Computing. |
| 2 | Rev.Ike ownership is unresolved or belongs elsewhere | Rev.Ike is an internal Exoskeleton subsystem. |
| 3 | Exoskeleton owns Ava007 cognition | Cybernetic-Ava007 owns governing intelligence and reasoning authority. Exoskeleton owns runtime execution. |
| 4 | Exoskeleton owns device/OS/hardware environments | Omni-OS owns operating environments and device, network, compute and hardware interfaces. |
| 5 | Rev.Ike is a separate reasoning authority | Rev.Ike performs Exoskeleton-owned intake, normalization, curation, provenance and grant-gated serving. |
| 6 | Mailbox implementation is proven sound because a seqlock validates reads | Concurrent non-atomic payload access requires a Rust-sound ownership/synchronization protocol. Revalidation alone does not make a data race legal. |
| 7 | Current mailbox pipeline is end-to-end zero-copy | Source contains payload construction, snapshot and JS/Arrow materialization copies. Measure each boundary; do not claim end-to-end zero-copy. |
| 8 | C ABI source proves N-API/WASM integration | A C ABI is not itself an N-API or WASM binding. Verify generated bindings and runtime calls. |
| 9 | GSAP frame animation proves a high-rate kinetic kernel | Frame-bound animation is not evidence of a headless inferential/kinetic compute kernel. Benchmark independently. |
| 10 | 0 ms replay or fixed high refresh rates are established | Report only measured latency under named hardware/runtime and workload. |
| 11 | TurboVec integration is complete | Treat the repository reference and intended seam as proposed until dependency pin, build and accuracy/performance tests are present. |
| 12 | “Implemented” means verified | Separate design, source presence, reported behavior, measured behavior and independently verified acceptance. |

## Evidence rule

A correction in this ledger is a documentation/architecture decision, not proof that the underlying code has been fixed. Link the implementing commit and validation record when a code-level correction is completed.
