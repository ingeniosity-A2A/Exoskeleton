# Kinetic Intelligence Retrieval — Whole-System Architecture and Benchmark Contract

**Recorded:** 2026-11-05  
**Repository:** `ingeniosity-A2A/Exoskeleton`  
**Status:** Architecture and benchmark specification; not a claim of completed integration or measured performance  
**System relationship:** Exoskeleton is the coordinated runtime/memory substrate in the Ava-007 system, architecturally analogous to the co-designed orchestration role of NVIDIA Vera Rubin—not equivalent silicon or hardware performance.

## 1. Purpose: test intelligence as a kinetic system

The objective is not to benchmark a vector database in isolation. It is to measure whether the complete system can acquire information, preserve its structure and provenance, atomize and organize memory, retrieve relevant evidence, reconstruct context, reason, and return an authorized result with low end-to-end overhead.

The benchmark must include:
- Hugging Face as an upstream source of models, datasets, papers, and evaluation corpora.
- Rustunnel as a controlled service transport / ingress option where it provides a demonstrated network capability.
- Docling and TableFormer for structure-preserving document ingestion.
- Atomic memory records as the auditable unit of knowledge.
- Holographic/associative memory as a separately measured representation and recall candidate.
- RyanCodrai's Rust TurboVec / TurboQuant as a compressed SIMD retrieval candidate.
- DuckDB 2.0 as structured durable Source Truth and metadata/ACL filter authority.
- DFM as a separate learned/parametric-memory experimental arm, not a substitute for the durable memory ledger.
- Ava-007 as the cognitive authority and acceptance controller.
- Ava-007 5G / edge network as a distributed connectivity and ingestion/serving fabric.
- Exoskeleton as the coordinated runtime, memory, scheduling, persistence, transport, and resource-governance substrate.

The test must answer: **How much useful, authorized, evidence-grounded intelligence is delivered per unit of latency, compute, memory, network traffic, energy, and operational complexity?**

## 2. Architectural analogy: Exoskeleton and NVIDIA Vera Rubin

The analogy is one of systems engineering and co-design. NVIDIA describes Vera Rubin as a tightly integrated platform across CPUs, GPUs, networking fabrics, infrastructure processors, software, security, and operations. Its central lesson is that utilization and efficiency depend on coordinated data movement, scheduling, synchronization, memory locality, and orchestration—not peak accelerator throughput alone.

Exoskeleton should be evaluated with the same systems-level discipline:
- Do not optimize TurboVec while ignoring document parsing, FFI, memory publication, network transport, DuckDB commits, or answer reconstruction.
- Do not optimize the 5G link while ignoring queueing, payload shape, retrieval fan-out, and endpoint compute.
- Do not call a component fast if it increases end-to-end latency or weakens correctness.
- Treat Exoskeleton as the substrate that coordinates heterogeneous components; Ava-007 remains the cognitive purpose, reasoning, acceptance, and authority owner.

This is an architectural analogy, not a claim that Exoskeleton has Vera Rubin's GPUs, NVLink bandwidth, coherent hardware fabric, power envelope, or performance.

## 3. End-to-end data and intelligence path

```text
Hugging Face Hub / approved source corpus
  -> pinned source manifest, revision and checksums
  -> controlled acquisition path
       direct HTTPS/Xet OR explicitly tested transport/cache path
  -> immutable source artifact
  -> Docling layout + reading-order + OCR + TableFormer
  -> structured document with page/region/table/cell provenance
  -> atomic knowledge records
  -> canonical DuckDB Source Truth + authorization metadata
  -> embedding generation and representation transforms
  -> TurboVec/TurboQuant retrieval projection
  -> optional holographic/associative memory projection
  -> query-time ACL/temporal/source filters in DuckDB
  -> filtered candidate retrieval and reranking
  -> context reconstruction with evidence/provenance
  -> REV.IKE read-only interpretation and proposal
  -> Ava-007 evaluation / accept-reject / action authorization
  -> measured outcome, audit and feedback
```

A separate experimental path may use retrieved chunk embeddings to train or construct DFM-style parametric memory, then evaluate inference with no explicit retrieval. It must remain separate from the online evidence-retrieval path so the comparison is honest.

## 4. Hugging Face acquisition and Rustunnel placement

### Hugging Face is the upstream corpus/model plane

Pin every source by:
- repository ID and repository type (model, dataset, or Space where relevant);
- immutable commit/revision;
- file paths, file sizes, and SHA-256 checksums where available;
- license and usage constraints;
- acquisition timestamp and source metadata;
- model/dataset configuration, split, and filtering criteria.

The Hugging Face Hub uses Xet-backed storage for model and dataset repositories. Downloads may redirect from `huggingface.co` to Xet CAS/transfer and CDN hosts. A network rule or test that reaches only `huggingface.co` is insufficient to prove full downloads work. Use Hugging Face's current machine-readable Hub metadata for the authoritative hostname list rather than hard-coding a stale list.

### Rustunnel is not automatically an outbound Hugging Face proxy

The documented Rustunnel architecture exposes local HTTP/TCP/UDP services through tunnels and offers P2P/QUIC and relay modes. It does not, by virtue of creating a tunnel, transparently route arbitrary outbound HTTPS requests from a client to Hugging Face.

Valid candidate designs:
1. **Direct acquisition:** the acquisition worker reaches the required Hugging Face/Xet/CDN endpoints over normal outbound HTTPS. This is the baseline and preferred path when it works.
2. **Remote controlled cache:** a worker downloads and verifies artifacts, then exposes a narrow, authenticated local cache or artifact API through Rustunnel for another authorized node to consume.
3. **Remote ingestion API:** a private ingestion service is exposed through Rustunnel so a remote edge node can submit source manifests or controlled acquisition jobs. The service itself performs outbound Hub access.
4. **Explicit egress proxy experiment:** only if a separately implemented and documented forward-proxy route exists. Do not represent a reverse tunnel as a forward proxy. Prove CONNECT behavior, DNS resolution, TLS end-to-end, redirect handling, Xet host coverage, auth isolation, and throughput before using it.

Do not expose a Hugging Face token to tunnel logs, dashboards, request inspectors, URL query strings, or downstream clients. Keep secrets in the acquisition worker's secret store/environment and redact authorization headers. Rustunnel tunnel authentication does not replace destination-service authorization.

Benchmark Rustunnel only where it actually participates in the data path: compare direct transfer, Tailscale path, Rustunnel relay, Rustunnel direct P2P/QUIC if negotiated, and a Rustunnel-exposed verified cache/API. Record direct-versus-relayed session state; do not infer it from configuration.

## 5. Docling and TableFormer: preserve document structure before embedding

Docling is the document-understanding/normalization stage, not merely a PDF-to-text converter. Its documented pipeline includes layout analysis, reading order, OCR options, table detection and structure reconstruction, formulas, figures, and provenance. TableFormer identifies table cells and their row/column relationships. The Docling model catalog documents fast and accurate TableFormer modes.

Required output preservation:
- document ID and immutable source revision;
- page number and bounding box / source region;
- reading-order sequence and section hierarchy;
- table ID, caption, header hierarchy, row/column indices, cell spans, and cell text;
- figure/image references and associated captions;
- formula content and normalized representation;
- OCR engine, model revision, extraction mode, and confidence where exposed;
- references back to the original source bytes.

Never flatten a complex table into a plain text sequence and then claim equivalent retrieval. A query for a numeric fact must be able to recover its table caption, row header, column header, unit, footnote, and exact source page/region.

Use fast mode for throughput screening and accurate mode for the quality baseline on complex tables. Benchmark both. Keep original source artifacts so parsing can be replayed after model or parser upgrades.

## 6. Atomic memory structure

Atomic memory is the canonical, auditable knowledge unit—not an embedding and not an arbitrary text chunk. An atom must be independently addressable and traceable to its source and context.

Candidate atom record (schema proposal; not a claim that every field is already implemented):

| Field | Purpose |
|---|---|
| `atom_id` | Stable immutable identity |
| `source_id`, `source_revision` | Origin and exact source version |
| `content`, `content_type` | Atomic text, value, entity, relation, event, table cell, formula, image descriptor, or observation |
| `parent_document`, `parent_chunk` | Structural context |
| `page`, `bbox`, `table_id`, `row`, `column` | Fine-grained provenance |
| `subject`, `predicate`, `object` | Explicit relation representation where applicable |
| `valid_time`, `recorded_time` | Temporal truth and ingestion history |
| `source_confidence`, `extraction_method` | Evidence quality and method |
| `tenant`, `role`, `policy_tags` | Authorization and filtering metadata |
| `embedding_model`, `embedding_revision`, `vector_id` | Reproducible retrieval projection linkage |
| `content_hash` | Integrity and deduplication |
| `acceptance_state`, `accepted_by` | Ava-007-controlled acceptance status |

Atomic records are durable Source Truth only after the governing Ava-007 acceptance boundary. Candidate extraction, model-generated summaries, inferred relations, and REV.IKE proposals remain explicitly non-authoritative until accepted. Keep source atoms separate from derived atoms and preserve derivation lineage.

A retrieval chunk may aggregate atoms for efficient context assembly, but it must not destroy atom identity, table hierarchy, provenance, or authorization metadata.

## 7. Holographic / associative memory

“Holographic memory” is an overloaded term across cognitive science, vector-symbolic architectures, hyperdimensional computing, distributed representations, and product-specific memory designs. Do not silently equate those approaches.

For this benchmark, treat holographic/associative memory as an experimental representation layer that may encode distributed relationships or superposed associations and support recall from partial/noisy cues. Before implementation, record the exact algorithm, binding/bundling operators, dimensionality, normalization, decoding method, collision behavior, and persistence format.

Test:
- partial-cue and noisy-cue recall;
- association binding and unbinding fidelity;
- interference/collision as memory size and overlap increase;
- false-positive and false-negative rates;
- compositional and temporal relation recovery;
- source attribution and provenance preservation;
- incremental update, deletion, replay, and rebuild behavior;
- memory footprint and query latency against atom+TurboVec baselines.

Holographic scores must never override source trust, ACL filters, or Ava-007 acceptance. A distributed representation is a retrieval aid, not the durable truth ledger.

## 8. RyanCodrai TurboVec / TurboQuant retrieval

Upstream project: https://github.com/RyanCodrai/turbovec

TurboVec is a Rust in-process vector index with Python bindings implementing TurboQuant-style 2-bit and 4-bit vector quantization and SIMD search. Its documented capabilities include online insertion/removal, incremental `sync()`, stable `uint64` IDs through `IdMapIndex`, and search-time allowlists. The project reports architecture-specific comparisons with FAISS; those upstream numbers are not Exoskeleton benchmark results and must not be copied into the acceptance ledger as local results.

Integration requirements:
1. Pin an upstream commit/release and license; inspect API, file format, unsafe code, feature detection, persistence semantics, and security posture.
2. Build and test on the actual target CPUs: ARM64 edge (including the intended S25/S26 execution path where supported) and x86_64 VPS.
3. Verify ARM NEON SDOT/SMMLA and x86 AVX-512/AVX2 dispatch paths as applicable; record actual selected kernel and scalar fallback.
4. Use stable IDs mapped to canonical atom/chunk IDs. Never treat mutable vector slot indices as durable memory identity.
5. Apply DuckDB authorization, tenant, role, time, and source filters before retrieval; pass the resulting allowlist into TurboVec's search kernel where supported.
6. Compare 2-bit and 4-bit memory/latency/recall and include a full-precision baseline.
7. Measure quantization distortion and recall against exact float ground truth on the actual corpus, including tables, low-dimensional embeddings, multilingual content, and mixed document types.
8. Verify incremental persistence, crash recovery, deletion, reload, and rebuild from canonical atoms.
9. Keep TurboVec a rebuildable retrieval projection. It is not the canonical ledger, not a network service, and not an authorization system.

Do not assume TurboVec's published FAISS speedups will hold on the VPS or Android hardware. The upstream project itself notes that its scan is linear in corpus size and recommends graph/IVF structures for very large corpora with strict latency budgets. Evaluate the correct scale and workload.

## 9. DFM: separate parametric-memory experiment

Deep Fusion Memory (arXiv:2610.25100) describes a chunk-level parametric memory path. A causal memory predictor learns to predict memory from preceding context, trained using retrieved chunk embeddings as supervision; predicted memory is shared within a chunk and fused into intermediate hidden states with gated cross-attention. The paper reports reduced construction retrieval requirements and inference without explicit online retrieval.

Place DFM as a distinct experimental arm:
- **External retrieval arm:** canonical atoms + Docling structure + DuckDB filters + TurboVec/holographic retrieval + evidence reconstruction.
- **Parametric-memory arm:** offline corpus retrieval and memory construction/training, then inference with the trained memory mechanism and no explicit retrieval call.
- **Hybrid arm:** parametric memory for learned background context plus external retrieval for fresh, provenance-sensitive, permission-filtered evidence.

DFM does not replace Source Truth, source provenance, access control, fresh retrieval, or the AVA-007 acceptance boundary. Measure knowledge freshness, update cost, forgetting/interference, factuality, evidence traceability, domain adaptation, training data retrieval cost, inference latency, and quality under changed or revoked source material.

## 10. Ava-007 5G and edge network plane

The Ava-007 5G system is a distributed edge connectivity and compute plane. It can connect sensing, acquisition, inference, and memory nodes across 5G/IoT/Wi-Fi/Tailscale/Rustunnel paths. It is not a coherent memory fabric equivalent to NVLink, and radio throughput alone does not establish low end-to-end latency.

Benchmark the full edge path:
- producer capture timestamp and local queue delay;
- RAN/modem transport, radio conditions, handover, packet loss, jitter, retransmission, and uplink/downlink throughput;
- Tailscale direct/DERP path and Rustunnel path where used;
- payload compression and serialization;
- edge/VPS queueing, inference, retrieval, and database commit;
- offline behavior, store-and-forward, idempotency, replay, and reconnection.

The device network adapter must report the actual path and radio/network telemetry. Do not claim a 5G uplink is established from a configured profile or emulator alone. Distinguish physical modem/RF evidence from software emulation and synthetic network tests.

## 11. Exoskeleton's co-designed substrate responsibilities

Exoskeleton coordinates:
- native Rust memory/compute structures and safe FFI boundaries;
- memory publication, leases, scheduling, and lifecycle;
- DuckDB durable ledger, transaction and event/outbox semantics;
- rebuildable TurboVec and optional associative projections;
- document ingestion orchestration and provenance propagation;
- network transport adapters (Tailscale, Rustunnel, 5G/edge) with explicit path identity;
- resource, concurrency, backpressure, observability, and recovery;
- replayable benchmarks and evidence artifacts.

Ava-007 retains cognitive purpose, reasoning, policy, source acceptance, curation decisions, authorization, and action authority. REV.IKE remains read-only interpretation/retrieval/context preparation/proposal generation. It cannot write Source Truth, accept proposals, promote memory, authorize, or execute.

## 12. Kinetic retrieval benchmark matrix

All arms use the same immutable corpus snapshot, query set, ground-truth judgments, hardware, concurrency, and durability policy.

| Experiment arm | Ingestion/representation | Retrieval | Purpose |
|---|---|---|---|
| A | Plain text baseline | Full-precision dense search | Baseline |
| B | Docling structured chunks | Full-precision dense search | Value of layout and table preservation |
| C | Docling + atomic memory | TurboVec 4-bit | Atomicity + compressed retrieval |
| D | Docling + atomic memory | TurboVec 2-bit | Compression/recall trade-off |
| E | Docling + atomic memory | Holographic/associative candidate | Partial-cue and relational recall |
| F | Docling + atomic memory | Hybrid SQL/keyword/dense/holographic | Complementary retrieval |
| G | DFM-trained memory | No explicit online retrieval | Parametric-memory comparison |
| H | DFM + external retrieval | Hybrid evidence-grounded response | Freshness/provenance balance |
| I | Same winning retrieval arm | Direct, Tailscale, Rustunnel relay, P2P/QUIC, and 5G paths | Transport and edge effects |

### Required metrics

**Retrieval quality**
- Recall@1/5/10/20, Precision@k, MRR, nDCG@k;
- exact entity/value retrieval and table cell accuracy;
- evidence coverage, source attribution correctness, citation/page/region correctness;
- ACL leakage rate (must be zero), stale/revoked source retrieval rate (must be zero where policy requires);
- answer correctness and unsupported-claim rate.

**Performance**
- ingestion and parse time per page/document/table;
- embedding and index-build time;
- query p50/p95/p99, throughput, queue depth, concurrency scaling;
- end-to-end request-to-evidence and request-to-answer latency;
- bytes transferred, copies, allocations, peak/retained memory, CPU/GPU use and energy where measurable;
- DuckDB commit/checkpoint time and projection update/rebuild time;
- network RTT, jitter, loss, retransmits, path type and reconnect/recovery time.

**Reliability and lifecycle**
- crash/restart recovery, incremental sync, index rebuild, deletion, source revision replacement;
- offline edge queue and replay;
- duplicate delivery and idempotency;
- reproducibility from pinned model/parser/index versions and corpus hashes.

### Ablations and controls

1. Plain text extraction versus Docling layout/reading order.
2. TableFormer fast versus accurate; measure structure accuracy and parse cost.
3. Arbitrary chunks versus atomic records versus structure-aware chunks.
4. TurboVec 2-bit versus 4-bit versus full precision.
5. Vector-only versus keyword/vector hybrid versus holographic associative retrieval.
6. DuckDB ACL prefilter versus no-filter negative control in a sealed test environment; production path must always enforce ACL.
7. Direct transfer versus Rustunnel-exposed verified cache/service; do not mislabel this as a Hugging Face forward-proxy comparison.
8. Local loopback versus Tailscale versus Rustunnel relay/P2P versus 5G edge path.
9. External retrieval versus DFM parametric memory versus hybrid.
10. Single-component microbenchmarks versus full lifecycle measurements.

Publish raw data, query judgments, corpus manifest, exact commands, source commits, model revisions, hardware/runtime details, and analysis scripts. Report confidence intervals and repeated-run distributions; never present one best run as the result.

## 13. Acceptance gates

- Source integrity and revision pinning verified.
- Docling output preserves reading order and page/region provenance.
- TableFormer output passes cell/header/span correctness checks on the benchmark set.
- Atomic memory records preserve derivation lineage, temporal validity, and ACL metadata.
- Holographic algorithm is precisely specified and measured against collision/false-recall tests before it is considered a candidate.
- TurboVec IDs map durably to canonical records; quantization recall and persistence pass.
- DuckDB remains authoritative; vector/associative projections are rebuildable.
- DFM comparison separates learned parametric memory from online retrieval and does not bypass governance.
- Rustunnel path is accurately classified; credentials are protected; direct/relay/forward-proxy semantics are not conflated.
- 5G results distinguish actual RF/device evidence from emulation.
- REV.IKE cannot mutate Source Truth or authorize actions.
- Ava-007 is the only acceptance and action authority.
- Full end-to-end benchmark demonstrates benefit without weakening security, provenance, durability, or answer quality.

## 14. Evidence status

At the time of writing:
- TurboVec upstream project and documented API/benchmark claims: reviewed; not yet integrated or independently reproduced in Exoskeleton.
- Docling/TableFormer capabilities: documented; not yet benchmarked on the project's corpus in this record.
- Hugging Face/Xet acquisition path: documented; actual egress reachability from project VPS/edge is not verified here.
- Rustunnel/Hugging Face routing: candidate designs defined; no outbound forward proxy or production path is assumed.
- Atomic and holographic memory: benchmark requirements defined; algorithm-specific implementation status must be established from source.
- DFM: paper reviewed; no DFM model training or runtime implementation is claimed.
- Ava-007 5G path: architecture role defined; physical RF/uplink proof is a separate gate.
- Exoskeleton/Vera Rubin: systems co-design analogy defined; no hardware equivalence is claimed.
- Kinetic end-to-end test: specified; no result is claimed.

**Governing objective:** maximize correct, authorized, provenance-grounded intelligence delivered per unit of time, compute, memory, network traffic, energy, and operational complexity. Optimize the complete system, not isolated components.
