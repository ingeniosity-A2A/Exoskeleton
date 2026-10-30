# pnpm Workspace and Store Policy

**Repository:** ingeniosity-A2A/Exoskeleton  
**Policy reviewed:** 2026-10-30  
**Target package manager:** pnpm 12.16.1

## Source of truth

The repository root owns package.json (package identity, Node engine, exact packageManager pin), pnpm-workspace.yaml (reviewed workspace globs and settings), pnpm-lock.yaml (committed generated dependency graph), and docs/VALIDATION.md (dated evidence for commands actually run).

Never hand-edit lockfile package versions or integrity values. Update the package-manager pin and regenerate the lockfile with that exact pnpm version in one change.

## Version policy

**Current state:** the committed package.json pins `pnpm@9.15.0` and pnpm-lock.yaml carries `lockfileVersion: '9.0'` (verified 2026-10-30).

**Target:** pnpm 12.16.1, the current official release (published 2026-10-27, https://pnpm.io/). Pin the exact version; do not use `latest` as the project's version pin. This is a two-major-line jump (9 → 12), so treat it as one atomic change rather than an incremental bump.

pnpm 12 is a Rust rewrite and has explicit frozen-lockfile syntax. Use `pnpm install --frozen-lockfile`; do not pass `--frozen-lockfile false`. Release notes: https://pnpm.io/blog/releases/12.0 and https://pnpm.io/blog/.

## pnpm command baseline

On a compatible Node.js 22+ environment, run from the Exoskeleton root:

    pnpm --version
    pnpm self-update 12.16.1
    pnpm --version

Then update the root packageManager field to `pnpm@12.16.1`, regenerate the lockfile using that exact pnpm binary, and verify:

    pnpm install --lockfile-only
    pnpm install --frozen-lockfile
    git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml

Do not update only one of package.json and the lockfile: regenerate and commit both with the exact pinned version before treating the update as complete.

If self-update is unavailable in the current environment, follow the official installation instructions for the target platform. Do not use the unqualified npm `latest` tag when it points to pnpm 11; official pnpm 12 instructions use the `latest-12` tag.

## Store boundaries

The Exoskeleton-owned repository-local store, when configured, belongs at `.pnpm-store/` within this checkout and must be Git-ignored. The store is cache data, not source-of-truth dependency metadata. The lockfile remains the reproducibility contract.

Configure a local store explicitly when one is required; do not assume the global store is repository-local, and do not assume `.npmrc` is the correct location for non-registry settings under pnpm 11/12. Configure the setting in a supported configuration location for the pinned release and verify the effective path with `pnpm store path`, following that release's pnpm-workspace.yaml configuration rules.

## Hard repository separation

- Exoskeleton: its own pnpm pin, workspace, lockfile, local package store, and code.
- Agent-X: separate pnpm configuration, workspace, lockfile, local store, and model-asset/runtime paths. Never merge its model weights or runtime artifacts into Exoskeleton.
- Ava007 / Cybernetic-Ava007: intellect and its own repository/package boundaries.
- Ava007-Omni-OS: execution environments and device/compute/browser capabilities.

No cross-repository store sharing by implicit path. Never place centralized stores inside Ava007 or anywhere outside this checkout. Keep model assets as data, not source code — never commit large model files. Do not move existing artifacts until current paths and ownership have been inspected and recorded.

## Workspace membership

The committed pnpm-workspace.yaml declares `packages: ['packages/*']` and a dependency `catalog:` (DuckDB 2.0, zod, protobufjs, gsap), verified 2026-10-30. Earlier revisions held `packages: []`; that changed when `packages/memory-chassis`, `packages/substrate-native`, `packages/librarian`, and `packages/capabilities` were added.

Add workspace package globs only when real packages exist and ownership has been reviewed. Do not add broad globs that accidentally include generated output, model assets, experiments, or Agent-X. Every workspace package must declare its own package.json. The catalog holds dependency versions only — capability names live in `packages/capabilities` CapabilityRegistry.

## Required upgrade procedure

1. Confirm clean working tree and inspect root files.
2. Install/use approved pnpm 12.16.1.
3. Update root packageManager field.
4. Regenerate pnpm-lock.yaml with pnpm 12.16.1; do not hand-edit it.
5. Run `pnpm install --frozen-lockfile`.
6. Verify `pnpm --version`, `node --version`, `pnpm store path`, workspace membership, and root-file diffs.
7. Record exact output in docs/VALIDATION.md.
8. Confirm Agent-X remains unchanged and independently configured.

## Security and reproducibility

- Use pnpm 12 build-script allowlist controls; review dependency build scripts rather than permitting all builds.
- Keep credentials in environment/secret management, never in committed manifests or logs.
- Keep node_modules/, .pnpm-store/, generated build output, local model assets, and runtime sandboxes out of Git.
- Use frozen installs in CI and reproducible environments.
- Treat lockfile changes as reviewable supply-chain changes.

## Current-state caveat

As of 2026-10-30, Exoskeleton's committed package.json pins **pnpm 9.15.0**, not 12.x, and pnpm-lock.yaml is still at `lockfileVersion: '9.0'`. This document specifies the intended upgrade to 12.16.1; it does not claim the lockfile has been regenerated or that the upgrade has been validated. Complete the upgrade as a single atomic change and record the evidence in docs/VALIDATION.md.
