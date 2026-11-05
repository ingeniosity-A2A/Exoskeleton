# Exoskeleton — AI and Runtime Observability

**Status:** design contract; implementation and runtime coverage must be verified  
**Reviewed:** 2026-11-04

## Purpose

Make Exoskeleton execution observable, reproducible and testable without claiming access to a model's private reasoning. Record the inputs supplied to the runtime, decisions exposed at system boundaries, capabilities selected, operations performed and outcomes validated.

Observability belongs to the Exoskeleton runtime. It must preserve the authority boundary: Cybernetic-Ava007 owns governing intelligence; Exoskeleton records and manages execution; Omni-OS provides the operating environment; Rev.Ike provides Exoskeleton-owned intake and curation functions.

## Ownership boundaries

- **Cybernetic-Ava007:** governing intelligence, purpose, reasoning authority and authorized intent.
- **Exoskeleton:** orchestration events, capability lifecycle, execution traces, resource measurements, interruption/recovery metadata and validation records.
- **Rev.Ike:** Exoskeleton-owned intake, normalization, curation, provenance and grant-gated materialization/serving.
- **Ava007 Omni Operating System:** devices, Linux/mobile edge, network, compute, containers, browser and hardware execution environments.
- **MA Computing:** A2A documentation and A2A-specific protocol material; not the owner of Exoskeleton telemetry.
- Other repositories retain their own data, model, skill and artifact authority. Exoskeleton may retain approved opaque references, not silently become their replacement source of truth.

## Required telemetry planes

### 1. Execution trace

Record trace/span/parent IDs, UTC timestamp, monotonic duration, component, capability and contract version, lifecycle event, status, retry/timeout/cancellation, artifact references and sanitized error class.

Lifecycle events should cover the transitions actually implemented: discover, validate, select, allocate, execute, observe, interrupt, reverse/compensate and release. Do not emit fictitious transitions.

### 2. Context and provenance

Record approved identifiers and hashes for intent envelope, prompt/template version, skill/capability version, model/provider metadata when exposed, retrieval references, input/output schema versions and artifact lineage. Do not log secrets, authorization headers, API keys, private content or full prompts by default.

### 3. Outcome and evaluation

Track explicit test results, schema validation, policy/authorization checks, task completion, latency, resource consumption, errors and recovery outcomes. Distinguish measured outcomes from model-generated assertions.

### 4. Model internals (optional)

Only capture internals when the selected model/runtime explicitly exposes them. Record model revision, tokenizer, layer/head, sampling configuration and capture method. Attention or activation views are diagnostics, not standalone explanations of an output.

## Event envelope

A versioned event contract should include:

`schema_version, trace_id, span_id, parent_span_id, timestamp, component, event, capability, contract_version, status, duration_ms, attributes, artifact_refs, redaction_policy`.

Validate events against a versioned schema before persistence/export. This document specifies the contract; it does not assert that the schema, exporter or dashboard is implemented.

## Security and retention

- Default to metadata, hashes and opaque references rather than raw content.
- Redact secrets before export; never put credentials in trace attributes.
- Enforce role-based access, retention limits and audit logs.
- Raw-content capture requires explicit enablement, access control, redaction and retention policy.
- Separate telemetry from authoritative memory, model assets and A2A documentation.
- Bound buffers and expose exporter drops/errors; telemetry failure must not silently alter execution semantics.
- Use synthetic fixtures and fake credentials in tests.

## Acceptance tests

- Valid events are accepted and malformed events rejected.
- Trace/span relationships propagate across nested capability calls.
- Secrets are redacted from nested attributes and errors.
- Exporter outage does not deadlock or corrupt lifecycle transitions.
- Unsupported model-internal capture returns an explicit unsupported status.
- Evaluation records identify code, configuration, capability and test revisions.
- Retention and raw-content settings are enforced.

## Proposed implementation sequence

1. Inspect existing source and avoid duplicate event abstractions.
2. Define and validate the event schema.
3. Instrument actual lifecycle and capability boundaries.
4. Add redaction, retention and trace-correlation tests.
5. Export through a provider-neutral interface.
6. Add evaluation and regression comparison.
7. Add dashboards only after trace contracts and runtime evidence exist.

## Definition of done

- [ ] Event schema committed and validated.
- [ ] Actual lifecycle transitions instrumented.
- [ ] Redaction, propagation and exporter-failure tests pass.
- [ ] Evaluation records identify exact revisions and test suites.
- [ ] Dashboards distinguish observed facts, derived metrics and hypotheses.
- [ ] Dated command output and tool versions recorded in `docs/VALIDATION.md`.

No build, test, benchmark, deployment or dashboard is implied by this design document.
