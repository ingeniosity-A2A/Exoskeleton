# Memory Governance and Liquid AI Sensory Nodes — Integration Proposal

**Recorded:** 2026-11-05  
**Repository:** `ingeniosity-A2A/Exoskeleton`  
**Status:** Architecture proposal and source-backed model registry only. No runtime integration or benchmark is claimed.  
**Authority:** Additive engineering document. It does not amend AVA-007 Manifestos, Core Canon, or Source Truth authority.

## 1. Ownership and authority

- **AVA-007 / Cybernetic-Ava007:** cognitive purpose, reasoning, interpretation, curation policy, acceptance/rejection of observations, and authorization of Source Truth changes.
- **REV.IKE:** read-only interpretation, candidate generation, memory research, and Observation Proposals. It cannot directly write Source Truth, accept its own proposals, authorize promotion, or execute actions.
- **Exoskeleton:** runtime memory mechanics, persistence adapters, synchronization, model-serving interfaces, transport, resource governance, and validation.
- **L0 SharedVectorMailbox + DuckDB ledger:** existing Exoskeleton memory substrate. This document does not certify its concurrent soundness, deployment state, or end-to-end zero-copy behavior.

The intended ordering remains:

`observe → record → retrieve context → interpret → propose → AVA-007 review → authorized commit → measure`

External libraries and model outputs are evidence-producing components, never authority.

## 2. Three technology roles

| Technology | Proposed role | Boundary |
|---|---|---|
| Mem0 OSS | Candidate memory extraction, deduplication, retrieval and lifecycle-management reference/adapter | Does not replace DuckDB Source Truth or become an authority |
| Liquid AI d1-Omni | Typed multimodal decision/scoring node | Produces candidate scores/typed answers; does not reason as AVA-007 or authorize actions |
| Liquid AI LFM3-Omni | General multimodal perception and text/speech response node | Perception/output only; not a decision authority |

The existing native memory substrate remains the persistence/transport foundation. Mem0 is not assumed to be a drop-in layer over it: Mem0 has its own supported storage and retrieval architecture. Integration must be through an explicit adapter and data ownership contract.

## 3. Mem0: verified behavior and proposed adapter

### 3.1 Verified facts

Mem0 publishes an Apache-2.0 open-source implementation and supports library and self-hosted-server deployment. Its documented architecture uses SQL for memory facts/metadata, a vector store for embeddings, and an entity store for relationship-aware retrieval. Its documented application loop is add/extract, search/retrieve, and application-controlled context injection.

Sources:
- https://github.com/mem0ai/mem0
- https://docs.mem0.ai/
- https://github.com/mem0ai/mem0/blob/main/docs/core-concepts/how-it-works.mdx
- https://github.com/mem0ai/mem0/blob/main/docs/open-source/overview.mdx

**Important correction:** `ADD / UPDATE / DELETE / NOOP` is a proposed internal Exoskeleton arbitration result, not a complete description of Mem0's public API contract. Mem0's public API exposes memory operations such as add, search, update, and delete; its extraction pipeline may perform its own deduplication and updates. Do not attribute the four-state enum or the supplied Rust algorithm to Mem0 itself.

### 3.2 Proposed integration

Use Mem0 initially as a bounded, replaceable candidate-memory extraction/retrieval adapter. Keep Exoskeleton's DuckDB ledger authoritative. The adapter returns a typed proposal; it does not commit to Source Truth.

Proposed internal decision type (not yet implemented):

- `AddCandidate`: genuinely new, provenance-backed information.
- `SupersedeCandidate`: evidence-backed correction with explicit target and reason.
- `DeletionProposal`: explicit evidence that a particular record should be retired; never delete solely because embeddings are similar or candidate confidence is lower.
- `NoChange`: duplicate or no meaningful new information.
- `NeedsReview`: ambiguous, conflicting, malformed, low-confidence, or out-of-policy case.

Do not collapse `DeletionProposal` into an immediate delete. Preserve prior records and append a reviewed tombstone/retraction event through the authorized ledger path so history and provenance remain auditable.

### 3.3 Audit of supplied Rust sketch — blockers before implementation

The supplied sketch is illustrative and is not ready to merge:

1. **Contradiction threshold is unreachable/redundant:** candidates are filtered to similarity >= 0.80, then compared against a contradiction threshold of 0.65. The lower threshold cannot distinguish the filtered set.
2. **Test/branch mismatch:** `stronger_evidence_triggers_update` uses existing confidence 0.7, but the implementation enters the contradiction branch only when confidence > 0.8. That test should not pass as written.
3. **Unsafe deletion semantics:** `wrong_memory_triggers_delete` deletes an existing record when the incoming candidate has a lower score (0.5 vs 0.9). A weaker candidate cannot establish that the old record is wrong.
4. **Similarity is not contradiction:** high cosine similarity establishes semantic proximity, not logical inconsistency. Contradiction needs a separately evaluated relation, source comparison, temporal scope, and evidence.
5. **Dimension mismatch is silently truncated:** `zip()` compares only the common prefix. Reject unequal dimensions and non-finite values.
6. **Numerical/error handling:** guard zero norms, NaN/Inf, invalid thresholds, and partial floating-point comparisons. Avoid `partial_cmp().unwrap()`.
7. **Missing lifecycle controls:** stable source IDs, idempotency, temporal validity, provenance, confidence calibration, concurrent arbitration, generation conflict handling, audit history, and rollback are not defined.
8. **Embedding model mismatch:** vectors from different models/revisions or normalization policies must not be compared without an explicit compatibility contract.

Acceptance requires deterministic unit tests for every operation, adversarial/conflict tests, temporal updates, malformed vectors, concurrency/idempotency, and replay/recovery. Compare against a no-Mem0 baseline on a reviewed memory benchmark before selecting it.

## 4. Liquid AI d1 decision models

### 4.1 Verified model identities

| Model | Verified characteristics | Candidate role |
|---|---|---|
| `LiquidAI/d1-Omni-2B` | 2.17B parameters; built on LFM3-Omni-2B; text/JSON, images, video and audio; typed answers with probabilities in one forward pass; no generated tokens; LFM Open License v1.0 | Higher-capability multimodal decision/scoring candidate |
| `LiquidAI/d1-omni-600M` | 587M parameters; built on LFM2.5-Encoder-350M, not LFM3; text, images and audio; 16,384 combined context positions; typed decisions without generated tokens; LFM Open License v1.0 | Smaller decision candidate for latency/resource evaluation |

Sources:
- https://huggingface.co/LiquidAI/d1-Omni-2B
- https://huggingface.co/LiquidAI/d1-omni-600M
- https://www.liquid.ai/blog/d1-open
- https://www.liquid.ai/blog/lfm3

**Corrections to the supplied YAML:**
- The current 2B repository identifier is `LiquidAI/d1-Omni-2B` (capital O in Omni).
- The 600M model is an LFM2.5-based model, not the same LFM3 architecture at a smaller size.
- The 600M card documents text/image/audio decision inputs; do not claim video support for it without a verified model-specific contract.
- d1 models return typed decision answers and probabilities, not speech. They are not chat/reasoning models.
- Vendor benchmark latency on named accelerators is not a device SLO. The proposed <10 ms threshold is unverified on the S26 Ultra/VPS and must not be treated as an achieved or guaranteed value.

### 4.2 Proposed decision contract

The adapter should accept a bounded state plus named questions/options and return:
- typed answer(s) and probability/calibration metadata where exposed by the model;
- model repository and immutable revision;
- preprocessing/configuration revision;
- modality coverage and truncation information;
- wall-clock latency and resource measurements;
- evidence pointers to the input records.

No generic `selected` action should execute directly. The node's output is a candidate signal for downstream validation. AVA-007 retains decision authority.

## 5. Liquid AI LFM3-Omni-2B perception node

### 5.1 Verified facts

The official `LiquidAI/LFM3-Omni-2B` model card describes a 2.17B-parameter, non-reasoning model with:
- text, image, video and audio input;
- text, 24 kHz speech, or interleaved text/speech output;
- 32K combined input/output context;
- video sampled at 2 fps, normally 4–384 frames;
- LFM Open License v1.0.

The published model card documents Transformers and SGLang paths and a GGUF variant for llama.cpp. It does not establish the proposed ONNX/NPU execution path for this model. Do not specify ONNX, NPU, or S26 Ultra acceleration as available until a supported export/backend and device test are verified.

Sources:
- https://huggingface.co/LiquidAI/LFM3-Omni-2B
- https://huggingface.co/LiquidAI/LFM3-Omni-2B-GGUF
- https://huggingface.co/blog/LiquidAI/lfm3

The published BF16/safetensors checkpoint is approximately 4.3 GB for the weight file; that is not the full runtime memory requirement. Runtime memory also includes activations, KV cache, encoders/codecs, preprocessing buffers, and framework overhead. Device feasibility must be measured with the actual quantized artifact and workload.

### 5.2 Proposed node role

Use LFM3-Omni as an optional multimodal perception/response service:
- ingest supported audio/image/video/text;
- emit grounded transcription, descriptions, answers, or speech output;
- attach timestamps/frame references and source IDs when available;
- return uncertainty/unsupported-input markers;
- pass extracted facts and interpretations into the same provenance-aware proposal pipeline.

It does not own memory arbitration, policy, tool authorization, or AVA-007 reasoning.

## 6. Proposed data flow

```
External inputs / tool results / approved observations
                      |
                      v
        LFM3-Omni perception (optional)
                      |
                      v
       Source-linked observations + timestamps
                      |
                      v
      d1-Omni typed decision/scoring (optional)
                      |
                      v
           REV.IKE interpretation
                      |
                      v
        Mem0 extraction / retrieval adapter
                      |
                      v
     Exoskeleton candidate arbitration interface
                      |
                      v
       L5A Observation Proposal + evidence
                      |
                      v
                AVA-007 review
                 /          \
             reject        accept
               |              |
          audit-only     authorized write
                              |
                              v
                     DuckDB Source Truth
```

This diagram describes a proposed orchestration. It is not an assertion that the model services, Mem0 adapter, or arbitration interface currently exist.

## 7. Security, provenance and licensing

- Treat all model outputs, transcribed audio, OCR, document content, and retrieved memories as untrusted data.
- No model output can directly invoke tools, mutate memory, change permissions, or trigger execution.
- Store source URI/ID, immutable revision, content digest, timestamp, model revision, preprocessing revision, and evidence offsets for every derived observation.
- Distinguish source-authored facts from model-inferred descriptions, scores, and REV.IKE interpretations.
- Verify the LFM Open License v1.0 terms and Mem0 Apache-2.0 terms against the intended distribution and deployment model. Do not assume all dependencies, quantizations, or third-party conversions inherit the upstream license.
- Do not upload private memory or user content to hosted services without an explicit data-flow and authorization review.
- Preserve a local-first path and explicit behavior when models/services are unavailable.

## 8. Implementation sequence and gates

### Gate 0 — source and artifact pinning
- Pin Mem0 version/commit, model revisions, tokenizer/processor revisions, and artifact digests.
- Record licenses and dependency SBOM.
- Verify current device/runtime support. No mutable `main` reference in production configuration.

### Gate 1 — isolated evaluation
- Evaluate Mem0 extraction, duplicate handling, temporal updates, retrieval quality, and deletion proposals on a reviewed corpus.
- Evaluate d1-Omni 600M and 2B on the same routing/triage/decision suite.
- Evaluate LFM3-Omni on actual audio, image, and video tasks relevant to the device workflow.
- Record precision/recall, calibration, false positives, false negatives, latency percentiles, peak RAM/VRAM, and energy where measurable.

### Gate 2 — adapter contracts
- Implement read-only inference/retrieval adapters.
- Validate JSON/schema contracts, timeouts, cancellation, malformed output handling, version mismatch and service-down behavior.
- Keep all writes disabled.

### Gate 3 — proposal-only integration
- Emit L5A proposals with source-linked evidence.
- Prove REV.IKE cannot write Source Truth or self-accept proposals.
- Prove model output cannot execute tools or actions.

### Gate 4 — authorized persistence
- Only after AVA-007 approval and existing Exoskeleton write-path validation, enable a narrowly scoped persistence adapter.
- Keep immutable audit history, idempotency keys, generation checks, and rollback/replay tests.

## 9. Explicit non-claims

This proposal does **not** claim:
- Mem0 is already integrated with the Rust mailbox or DuckDB;
- the supplied `mem0_arbitration.rs` compiles or passes its tests;
- d1-Omni runs through ONNX or the S26 Ultra NPU;
- either Liquid model meets 10 ms or 100 ms latency targets on the user's hardware;
- LFM3-Omni is a reasoning model;
- the existing mailbox is fully Rust-memory-model sound or end-to-end zero-copy;
- any model, dataset, or proposal can write Source Truth without AVA-007 authorization.

**Disposition:** accept as a research and integration plan. Runtime implementation remains blocked on source pinning, adapter contracts, model/runtime validation, and the existing memory-plane soundness gates documented in `docs/LAYER_0_MEMORY_PLANE.md` and `docs/VECTOR_CORE.md`.
