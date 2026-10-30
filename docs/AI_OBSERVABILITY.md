# Exoskeleton AI Observability

**Status:** Proposed implementation contract; not an implementation report  
**Last reviewed:** 2026-10-30

## Purpose

Make Exoskeleton executions observable, reproducible, and testable without confusing application traces with claims about an LLM's private reasoning. Record what the system supplied, selected, executed, and validated.

Implement provider-neutral observability for Exoskeleton orchestration. The first milestone is execution tracing and outcome validation, not reconstruction of a model's private chain of thought. Model-internal telemetry is optional and backend-dependent.

## Ownership boundaries

- **Cybernetic-Ava007:** intellect; intent and decisions.
- **Exoskeleton:** orchestration kernel, capability contracts, lifecycle, trace correlation, measurement, interruption and recovery metadata.
- **Ava007-Omni-OS:** execution environments and device, network, browser, and compute capabilities.
- **Agent-X:** isolated experimental/edge skill execution. It retains its own package configuration, lockfile, dependency store, and model assets.
- **Forged-Filing-Sys / Core-Membrain:** their existing filing and memory responsibilities; Exoskeleton traces may reference approved IDs but must not become an alternate memory authority.
- **fapo-ran:** separate RAN domain.

Exoskeleton requests capabilities through explicit contracts. It must not embed a GPU, modem, browser engine, device runtime, or model-weight distribution.

## Observability planes

### 1. Orchestration trace — required

Record trace/span/parent IDs, UTC timestamp, duration, status, capability name and contract version, lifecycle event (discover, select, allocate, execute, observe, interrupt, reverse, release), artifact references, retries, timeouts, cancellation, and sanitized error class.

### 2. Context provenance — required, redacted

Record prompt/template version and hash; skill ID/version/hash; memory retrieval references and scores where available; model provider/model identifier and inference configuration when exposed; input/output schema versions and output hash. Do not log secrets, authorization headers, API keys, private user content, or full prompts by default. Raw content capture requires explicit enablement, access control, redaction, and retention limits.

### 3. Outcome and evaluation — required

Track correctness against explicit tests, schema validation, policy checks, task completion, latency, resource consumption, and error rates. Distinguish measured outcomes from model-generated claims.

### 4. Model internals — optional

Only where the selected model/runtime exposes them: token IDs and logits/top-k probabilities; attention tensors and layer activations; feature/SAE activations and intervention results; embeddings and dimensionality-reduction projections. Record model revision, tokenizer, layer/head, sampling configuration, and capture method. Attention weights are diagnostics, not standalone explanations of outputs.

## Event envelope

The versioned event schema must include: schema_version, trace_id, span_id, parent_span_id, timestamp, component, event, capability name and contract version, status, duration_ms, attributes, artifact_refs, and redaction policy metadata. Validate events against a versioned JSON Schema before storing or exporting them. This is a proposed contract, not a claim that implementation exists.

## Dashboard views

1. Execution timeline: spans, dependencies, lifecycle transitions, failures, retries, cancellation.
2. Capability graph: requested capability, selected provider, contract version, allocation and release.
3. Context provenance: skill and retrieval references, model metadata, redaction status.
4. Evaluation: pass/fail by suite and version, regression diffs, schema violations.
5. Performance: p50/p95 latency, throughput, timeout rate, measurable resource cost.
6. Internals lab: optional attention/activation/embedding views for supported models.

## Data and security rules

- Default to metadata, hashes, and opaque references rather than raw content.
- Redact secrets before export; never put secrets in trace attributes.
- Enforce retention, access controls, and audit logs.
- Separate telemetry storage from authoritative memory and model assets.
- Sample high-volume traces and retain errors/evaluation failures according to policy.
- Never infer confidence from generated prose unless a defined, calibrated measure supports it.
- Treat dimensionality-reduction plots as lossy projections, not literal maps of the full representation space.
- Avoid metric labels containing trace IDs, prompts, user IDs, or other unbounded values.

## Contract requirements

1. Events are versioned and validated.
2. Trace IDs propagate through nested capability calls.
3. Durations use monotonic elapsed time; event timestamps use UTC RFC 3339.
4. Errors use stable codes and sanitized messages.
5. Raw prompts, completions, credentials, and memory payloads are not emitted by default.
6. Model-internal events are optional and include model/runtime revision and capture method.
7. Exporter failure must not silently change capability semantics. Define bounded buffering and explicit drop/error counters.
8. Tests use synthetic fixtures and fake credentials; never commit live secrets or private production traces.

## Proposed modules

The repository layout is `packages/*` (pnpm workspace globs), not a top-level `src/`. These paths are proposed against that layout — confirm package ownership after inspection and do not create duplicate modules if an equivalent exists.

- `packages/memory-chassis/src/observability/event.ts` — typed event envelope and constructors.
- `packages/memory-chassis/src/observability/schema.json` — versioned JSON Schema.
- `packages/memory-chassis/src/observability/redact.ts` — secret and sensitive-field redaction.
- `packages/memory-chassis/src/observability/trace-context.ts` — trace/span propagation.
- `packages/memory-chassis/src/observability/exporter.ts` — exporter interface and no-op default.
- `packages/memory-chassis/src/observability/evaluation.ts` — test result and regression record contracts.
- `tests/observability/` — schema, redaction, propagation, and exporter tests.

## Minimum tests

- Valid event accepted; malformed event rejected.
- Missing trace context is initialized safely at the entry boundary.
- Parent/child span relationships survive nested capability calls.
- Secrets in nested attributes and error messages are redacted.
- Exporter outage does not deadlock execution lifecycle.
- Unsupported model-internals capability returns explicit unsupported status.
- Evaluation results identify code/config/test revision.
- Retention and raw-content capture settings are enforced.

## Acceptance criteria

- Every execution correlates across Exoskeleton spans and capability calls.
- Each span has schema version, status, timestamps, and safe error metadata.
- Tests prove secret redaction and malformed-event rejection, and redaction and trace-propagation tests pass.
- Replay/evaluation records identify the skill, contract, available model metadata, and test version.
- Dashboard labels distinguish observed facts, derived metrics, and hypotheses.
- Model-internal panels degrade gracefully when the backend does not expose tensors.

## Implementation sequence

1. Define and validate the event schema.
2. Instrument lifecycle and capability boundaries.
3. Add redaction, retention, and trace-correlation tests.
4. Export traces and metrics through a provider-neutral interface.
5. Add evaluation registry and regression comparison.
6. Build timeline and performance views.
7. Add optional model-internal adapters only after runtime capability is verified.

## Definition of done

- [ ] Source layout and runtime inspected; no duplicate abstractions.
- [ ] Event schema committed and validated.
- [ ] Instrumentation covers discover/select/allocate/execute/observe/interrupt/reverse/release where those transitions exist.
- [ ] Dashboard consumes versioned traces.
- [ ] docs/VALIDATION.md contains dated command output and exact tool versions.
- [ ] No claims of passing tests or working dashboards without recorded evidence.

No build, test, benchmark, or runtime integration is implied by this design document. Record actual command output in docs/VALIDATION.md.
