# Exoskeleton Capability Layer

**Scope:** runtime capability contracts and lifecycle  
**Authority boundary:** Cybernetic-Ava007 authorizes intent; Exoskeleton orchestrates; Omni-OS owns the operating environment.

## Purpose

A capability is a named, versioned contract through which Exoskeleton requests a bounded operation and receives a uniform observation. The caller should not need to know whether the provider is a local function, remote service, device adapter, model-backed service or composed workflow.

A capability contract is not an intelligence authority. It cannot override Cybernetic-Ava007 policy or acquire privileges merely by appearing in the registry.

## Distinct mechanisms

| Mechanism | Responsibility |
|---|---|
| pnpm workspace/catalog | Package membership and dependency-version consistency |
| Capability registry | Names, versions, schemas, providers and authorization metadata for invocable abilities |
| Exoskeleton orchestrator | Validation, selection, allocation, lifecycle, timeout, cancellation, observation and release |
| Omni-OS adapter/provider | Concrete device, network, browser, compute, container and hardware operation |
| Cybernetic-Ava007 | Governing intent, reasoning authority and authorization policy |

Do not merge package dependency management with runtime capability discovery.

## Contract envelope

A capability definition should declare:

- Stable capability name and semantic version.
- Input and output schemas.
- Required authority/grants and execution identity.
- Provider identity and environment requirements.
- Timeout, cancellation and resource limits.
- Idempotency/retry semantics.
- Observable status and structured error codes.
- Provenance and artifact references.

A successful provider call returns a structured observation. It must not silently claim completion when the provider has only accepted or queued work.

## Lifecycle

```
Authorized intent
      |
      v
validate policy + capability contract
      |
      v
discover -> select -> allocate
      |
      v
execute -> observe -> validate outcome
      |
      +---- interrupt / compensate where supported
      |
      v
release resources + persist evidence
```

The implementation must make unsupported transitions explicit. “Reverse” is not universally possible; irreversible actions require compensation semantics and must be documented as such.

## Current source surface

The repository contains `packages/capabilities` with registry, types, index, audio sensing and composed-harness source. Presence of these files is source-level evidence only. Provider integrations, authorization enforcement and end-to-end lifecycle remain subject to validation.

## Non-goals and boundaries

- Exoskeleton does not own Ava007's identity, purpose or governing reasoning.
- Exoskeleton does not own the Omni-OS device or operating environment.
- Exoskeleton does not become an A2A protocol/documentation authority; A2A documentation belongs to MA Computing.
- A composed capability is not permission to bypass policy, provenance or isolation.
- A mock provider is not evidence of a production provider.

## Acceptance criteria

- Contract schemas are validated before execution.
- Authorization is enforced at the runtime boundary.
- Provider selection is recorded with version and provenance.
- Timeouts, cancellation, retries and partial failures have defined semantics.
- Results are structured, validated and trace-correlated.
- Resource release and compensation behavior are tested.
