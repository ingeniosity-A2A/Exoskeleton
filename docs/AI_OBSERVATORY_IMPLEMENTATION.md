# AI Observatory — Implementation Plan

**Status:** Implementation specification; not an implementation report  
**Target repository:** ingeniosity-A2A/Exoskeleton

## Goal

Implement provider-neutral observability for Exoskeleton orchestration. The first milestone is execution tracing and outcome validation, not reconstruction of an LLM's private chain of thought.

## Proposed modules

Adapt these names to the existing source layout after inspection; do not create duplicate modules if an equivalent exists.

- src/observability/event.ts — typed event envelope and constructors.
- src/observability/schema.json — versioned JSON Schema.
- src/observability/redact.ts — secret and sensitive-field redaction.
- src/observability/trace-context.ts — trace/span propagation.
- src/observability/exporter.ts — exporter interface and no-op default.
- src/observability/evaluation.ts — test result and regression record contracts.
- tests/observability/ — schema, redaction, propagation, and exporter tests.

These are proposed paths. Confirm the repository's current language and layout before adding implementation files.

## Contract requirements

1. Events are versioned and validated.
2. Trace IDs propagate through nested capability calls.
3. Durations use monotonic elapsed time; event timestamps use UTC RFC 3339.
4. Errors use stable codes and sanitized messages.
5. Raw prompts, completions, credentials, and memory payloads are not emitted by default.
6. Model-internal events are optional and include model/runtime revision and capture method.
7. Exporter failure must not silently change capability semantics. Define bounded buffering and explicit drop/error counters.
8. Avoid metric labels containing trace IDs, prompts, user IDs, or other unbounded values.
9. Tests use synthetic fixtures and fake credentials; never commit live secrets or private production traces.

## Minimum tests

- Valid event accepted; malformed event rejected.
- Missing trace context is initialized safely at the entry boundary.
- Parent/child span relationships survive nested capability calls.
- Secrets in nested attributes and error messages are redacted.
- Exporter outage does not deadlock execution lifecycle.
- Unsupported model-internals capability returns explicit unsupported status.
- Evaluation results identify code/config/test revision.
- Retention and raw-content capture settings are enforced.

## Definition of done

- [ ] Source layout and runtime inspected; no duplicate abstractions.
- [ ] Event schema committed and validated.
- [ ] Instrumentation covers discover/select/allocate/execute/observe/interrupt/reverse/release where those transitions exist.
- [ ] Redaction and trace-propagation tests pass.
- [ ] Dashboard consumes versioned traces and distinguishes measurements from interpretations.
- [ ] docs/VALIDATION.md contains dated command output and exact tool versions.
- [ ] No claims of passing tests or working dashboards without recorded evidence.

## pnpm command baseline

As of 2026-10-20, the latest official pnpm 12 release found is **12.14.0**, released 2026-10-15. pnpm 12 is the intended major line. Official notes: https://pnpm.io/blog/ and https://pnpm.io/blog/releases/12.0.

The repository currently declares pnpm 12.10.0 in package.json and its lockfile. Do not update only one of these: regenerate and commit the lockfile with the exact pinned version before treating the update as complete.

On a compatible Node.js 22+ environment, run from the Exoskeleton root:

    pnpm --version
    pnpm self-update 12.14.0
    pnpm --version

Then update the root packageManager field to pnpm@12.14.0, regenerate the lockfile using that exact pnpm binary, and verify:

    pnpm install --lockfile-only
    pnpm install --frozen-lockfile
    git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml

If self-update is unavailable in the current environment, follow the official installation instructions for the target platform. Do not use the unqualified npm latest tag when it points to pnpm 11; official pnpm 12 instructions use the latest-12 tag.

## Workspace and store boundaries

- Keep Exoskeleton's package.json, pnpm-workspace.yaml, and pnpm-lock.yaml in this repository.
- Keep a repository-local package store under Exoskeleton (for example, .pnpm-store/) and Git-ignore it. Configure explicitly when a local store is required; do not assume the global store is repository-local.
- Do not place centralized stores inside Ava007 or outside the Exoskeleton repository.
- Agent-X must maintain its own pnpm configuration, workspace, lockfile, package store, and model-asset paths. Do not merge its model weights or runtime artifacts into Exoskeleton.
- Keep model assets as data, not source code; do not add large model files to Git.
- Only add workspace package globs when real packages exist and have been reviewed. Current packages: [] is intentional until then.