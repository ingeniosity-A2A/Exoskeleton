# pnpm Workspace and Store Policy

**Repository:** `ingeniosity-A2A/Exoskeleton`  
**Reviewed:** 2026-11-04

## Ownership

This policy governs only the Exoskeleton repository's package graph, lockfile and package store. It does not govern Cybernetic-Ava007, Omni-OS, MA Computing, or other repositories. A2A documentation ownership is MA Computing's responsibility and is unrelated to pnpm workspace ownership.

## Sources of truth

- Root `package.json`: package identity, Node engine and exact `packageManager` pin.
- `pnpm-workspace.yaml`: workspace membership and dependency catalogs.
- `pnpm-lock.yaml`: generated dependency graph.
- `docs/VALIDATION.md`: dated evidence for commands actually run.

Never hand-edit lockfile package versions or integrity values. Change the package-manager pin and regenerate the lockfile with that exact pnpm version as one reviewed change.

## Observed repository state

At the inspected repository revision, root `package.json` pins `pnpm@9.15.0`. The workspace declares `packages/*` and a dependency catalog. This document does not claim that a later pnpm version has been installed or that an upgrade has been validated.

The earlier target of pnpm 12.16.1 is a proposed upgrade target, not the current repository pin. Recheck the official pnpm release and platform installation guidance at the time of upgrade; do not treat a historical target as permanently current.

## Workspace membership

Current declared workspace glob: `packages/*`.

The catalog contains dependency versions only. Capability names and runtime contracts belong to the Exoskeleton capability registry, not the pnpm catalog.

Add workspace packages only when their directories contain real package manifests and their ownership has been reviewed. Avoid globs that capture generated output, model assets, experiments or unrelated repositories.

## Store boundaries

- Exoskeleton's repository-local store, if configured, belongs inside this checkout and must be Git-ignored.
- The store is cache data, not dependency authority; the lockfile is the reproducibility contract.
- Do not assume the global store is repository-local.
- Do not share stores across repositories by implicit path.
- Do not place model assets or runtime sandboxes in the package store.
- Keep credentials out of manifests, lockfiles and logs.

## Upgrade procedure

1. Inspect the root manifests and current lockfile.
2. Select and install an exact pnpm release compatible with the supported Node runtime.
3. Update the `packageManager` field.
4. Regenerate the lockfile with that exact binary.
5. Run `pnpm install --frozen-lockfile`.
6. Verify package membership, `pnpm store path`, Node/pnpm versions and root-file diffs.
7. Run the package build/typecheck/test commands that actually exist.
8. Record exact output and environment in `docs/VALIDATION.md`.

Do not label the upgrade complete until the manifest, lockfile and measured install all agree.

## Framework separation

- **Cybernetic-Ava007:** governing intelligence and its own repository/package boundary.
- **Exoskeleton:** this repository's runtime substrate, Rev.Ike and package graph.
- **Omni-OS:** operating environment and device/compute capabilities; independently managed.
- **MA Computing:** A2A documentation and protocol material; not part of this workspace.

No package manager policy authorizes copying code, model assets, secrets or lockfiles between these systems.
