# pnpm Workspace and Store Policy

**Repository:** ingeniosity-A2A/Exoskeleton  
**Policy reviewed:** 2026-10-20  
**Target package manager:** pnpm 12.14.0

## Source of truth

The repository root owns package.json (package identity, Node engine, exact packageManager pin), pnpm-workspace.yaml (reviewed workspace globs and settings), pnpm-lock.yaml (committed generated dependency graph), and docs/VALIDATION.md (dated evidence for commands actually run).

Never hand-edit lockfile package versions or integrity values. Update the package-manager pin and regenerate the lockfile with that exact pnpm version in one change.

## Version policy

Use the current approved pnpm 12 patch release, presently 12.14.0 according to the official release page checked on 2026-10-20. Pin the exact version; do not use latest as the project's version pin.

pnpm 12 is a Rust rewrite and has explicit frozen-lockfile syntax. Use pnpm install --frozen-lockfile; do not pass --frozen-lockfile false. See https://pnpm.io/blog/releases/12.0.

## Store boundaries

The Exoskeleton-owned repository-local store, when configured, belongs at .pnpm-store/ within this checkout and must be Git-ignored. The store is cache data, not source-of-truth dependency metadata. The lockfile remains the reproducibility contract.

For a local store, configure the setting in a supported configuration location for the pinned release and verify the effective path using pnpm store path. Do not assume .npmrc is the correct location for non-registry settings under pnpm 11/12; follow the pinned release's pnpm-workspace.yaml configuration rules.

## Hard repository separation

- Exoskeleton: its own pnpm pin, workspace, lockfile, local package store, and code.
- Agent-X: separate pnpm configuration, workspace, lockfile, local store, and model-asset/runtime paths.
- Ava007 / Cybernetic-Ava007: intellect and its own repository/package boundaries.
- Ava007-Omni-OS: execution environments and device/compute/browser capabilities.

No cross-repository store sharing by implicit path. Do not move existing artifacts until current paths and ownership have been inspected and recorded.

## Workspace membership

The current Exoskeleton workspace has packages: []. Preserve that until a real JavaScript/TypeScript package exists and ownership is reviewed. Do not add broad globs that accidentally include generated output, model assets, experiments, or Agent-X. When packages are added, each must declare its own package.json.

## Required upgrade procedure

1. Confirm clean working tree and inspect root files.
2. Install/use approved pnpm 12.14.0.
3. Update root packageManager field.
4. Regenerate pnpm-lock.yaml with pnpm 12.14.0; do not hand-edit it.
5. Run pnpm install --frozen-lockfile.
6. Verify pnpm --version, node --version, pnpm store path, workspace membership, and root-file diffs.
7. Record exact output in docs/VALIDATION.md.
8. Confirm Agent-X remains unchanged and independently configured.

## Security and reproducibility

- Use pnpm 12 build-script allowlist controls; review dependency build scripts rather than permitting all builds.
- Keep credentials in environment/secret management, never in committed manifests or logs.
- Keep node_modules/, .pnpm-store/, generated build output, local model assets, and runtime sandboxes out of Git.
- Use frozen installs in CI and reproducible environments.
- Treat lockfile changes as reviewable supply-chain changes.

## Current-state caveat

At authoring time, Exoskeleton's committed package.json and pnpm-lock.yaml still pin pnpm 12.10.0. This document specifies the intended upgrade; it does not claim that the lockfile has been regenerated or that the upgrade has been validated. Complete the upgrade as a single atomic change and update docs/VALIDATION.md with evidence.