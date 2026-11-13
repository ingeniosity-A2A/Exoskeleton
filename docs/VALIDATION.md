# Validation record

Date (UTC): 2026-10-18T19:08Z
Node: v24.18.0   pnpm: 12.10.0   (Local evidence: commands run on this machine)

## Ran and succeeded
- `pnpm install` (generated pnpm-lock.yaml)
- `pnpm install --frozen-lockfile`

## Output
```
Already up to date
Done in 18ms using pnpm v12.10.0
```

## What this does NOT prove
The workspace has no packages and no project dependencies. The lockfile pins
only the pnpm toolchain itself (integrity hashes), so this confirms only that
the pinned pnpm resolves and installs. No build, test, deploy, Rust, or Python
check has been run.

## Dependency stewardship snapshot

Audit date: 2026-11-13. The checkout at `815ffc1d388cb77520dc06ebec37572681ab94ee` is 99 commits behind `origin/main` at `fdffc34bbe99e3f36fba6be9143f70afcd083ac2`; the original local changes were preserved. The current upstream snapshot's manifests and lockfile were inspected read-only. `gh` 2.103.3 is authenticated. `gh repo view OWNER/REPO --json nameWithOwner,url,isArchived,licenseInfo` resolved the eight declared dependency source repositories listed in `docs/DEPENDENCY_LEDGER.md`; this confirmed repository URLs/existence only, not license compliance, latest versions, compatibility, or update status. `gh skill list --scope project --json skillName,path,scope,sourceURL,version` discovered the local `github-dependency-steward` skill.

Finding: current upstream `package.json` specifies pnpm 9.15.0 while its lockfile root importer records pnpm 12.10.0 and omits workspace dependency importers. `Cargo.toml` declares optional TurboVec 1.1.2 without a Cargo.lock in the inspected tree. Dependency update/install validation is therefore blocked pending a clean, current-branch reconciliation. No packages or skills were installed, no update scan was completed, and no dependency test passed in this turn.

Reproduce the read-only checks with:

```sh
git -C Exoskeleton rev-parse HEAD origin/main
git -C Exoskeleton show origin/main:package.json
git -C Exoskeleton show origin/main:pnpm-lock.yaml
git -C Exoskeleton show origin/main:packages/substrate-native/Cargo.toml
gh repo view microsoft/TypeScript --json nameWithOwner,url,isArchived,licenseInfo
```
