# Exoskeleton Dependency and Skill Source Ledger

**Purpose:** give a delegated dependency-maintenance bot one source-linked inventory and a fail-closed audit starting point. GitHub CLI (`gh`) is the bot's interface for GitHub-hosted source, release, and skill inspection. Ecosystem package managers remain responsible for resolving packages and producing lockfiles; `gh` is not a replacement for pnpm, Cargo, or pip.

**Authority:** Rev.Ike may inspect, compare, and propose dependency or skill changes. It cannot install, update, accept, authorize, or execute them. The delegated maintenance bot owns recurring dependency checks and news. Once the lockfile/package-manager mismatch below is repaired and its baseline validation passes, the bot is authorized to apply pnpm stable patch/minor updates in a review branch, run validation, and send a concise report. It must stop for pnpm major updates, failed/absent validation, or any other dependency change outside that policy. No automatic merge, publish, deployment, or Exoskeleton daemon is authorized or required.

## Snapshot and known blocker

- Inspected source snapshot: `origin/main` at `fdffc34bbe99e3f36fba6be9143f70afcd083ac2`.
- The checked-out local `main` is `815ffc1d388cb77520dc06ebec37572681ab94ee`, 99 commits behind that snapshot, with pre-existing local modifications and untracked files. The delegated bot must fetch and verify its target branch before using this ledger.
- `package.json` declares `packageManager: pnpm@9.15.0`; `pnpm-lock.yaml` records pnpm `12.10.0` and its root importer contains no project dependency importers, despite workspace package manifests declaring dependencies. **Block dependency updates and frozen-install claims until this mismatch is reconciled on the current target branch.** Do not regenerate or overwrite the lockfile as part of a routine update scan.
- `Cargo.toml` pins optional `turbovec = 1.1.2`, but the inspected tree has no `Cargo.lock`.
- The local untracked `requirements.txt` is not part of the inspected `origin/main` snapshot and is not treated as an upstream project dependency declaration here.

## Declared direct dependencies

Versions below are the manifest specifications in the inspected snapshot, not independently verified latest versions. Links are the canonical upstream GitHub repositories; validate each with `gh repo view` before acting.

| Dependency | Ecosystem / use | Declared specification | Official GitHub source |
|---|---|---:|---|
| TypeScript | npm; root development dependency | `^5.6.3` | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) |
| DuckDB Node binding (`duckdb`) | npm; memory chassis | catalog `^2.0.0` | [duckdb/duckdb-node](https://github.com/duckdb/duckdb-node) |
| DuckDB-Wasm (`@duckdb/duckdb-wasm`) | npm; memory chassis | catalog `^2.0.0` | [duckdb/duckdb-wasm](https://github.com/duckdb/duckdb-wasm) |
| GSAP | npm; memory chassis | `^3.12.5` | [greensock/GSAP](https://github.com/greensock/GSAP) |
| Zod | npm; memory chassis | catalog `^3.23.8` | [colinhacks/zod](https://github.com/colinhacks/zod) |
| TurboVec (`turbovec`) | Cargo; optional `turbovec` feature | exact `=1.1.2` | [RyanCodrai/turbovec](https://github.com/RyanCodrai/turbovec) |

## Catalog entries not currently consumed

These are configured pnpm catalog entries, but no inspected workspace package currently declares them as dependencies. Do not report them as installed dependencies or fetch them unless a package begins consuming them.

| Package | Catalog specification | Official GitHub source | Snapshot status |
|---|---:|---|---|
| protobufjs | `^7.4.0` | [protobufjs/protobuf.js](https://github.com/protobufjs/protobuf.js) | Catalog-only; no consumer found |
| protobufjs (`legacy-modem` catalog) | `^6.11.3` | [protobufjs/protobuf.js](https://github.com/protobufjs/protobuf.js) | Catalog-only; no consumer found |

## Build and network tools (not application package dependencies)

These tools are tracked separately so the bot does not confuse an installed operator tool, a runtime service, or an architecture option with a package declared by Exoskeleton.

| Tool / service | Observed state | Official GitHub source | Role |
|---|---|---|---|
| pnpm | Manifest requires 9.15.0; local executable is 12.10.0; upstream lock records 12.10.0 | [pnpm/pnpm](https://github.com/pnpm/pnpm) | Workspace install/lockfile manager; mismatch blocks updates |
| GitHub CLI (`gh`) | Local 2.103.3; authenticated to `ingeniosity-A2A` during this audit | [cli/cli](https://github.com/cli/cli) | Delegated bot's GitHub metadata, release, repository, and skill interface |
| Tailscale | S26 app 1.104.6 and VPS node 1.104.5, as shown in the supplied machine records | [tailscale/tailscale](https://github.com/tailscale/tailscale) | Existing overlay and VPS exit-node service; not a declared code dependency |
| Tailcat | Local Termux executable 0.7.0 | [tailscale/tailcat](https://github.com/tailscale/tailcat) | Optional encrypted point-to-point/SOCKS transport; not installed in Exoskeleton |
| Headscale | No executable found in the inspected Termux PATH | [juanfont/headscale](https://github.com/juanfont/headscale) | Alternative self-hosted Tailscale-compatible coordination server; not installed |
| Rustunnel | No executable found in the inspected Termux PATH | [joaoh82/rustunnel](https://github.com/joaoh82/rustunnel) | Optional service tunnel; not a general-purpose phone internet exit |

## Dependency-skill sources

No third-party dependency skills were found in the inspected `origin/main` tree. The repository skill added alongside this ledger is local Exoskeleton guidance, not an external dependency. For a proposed GitHub-hosted skill, record its exact repository, skill name, reviewed commit, license, and installed path; preview it with `gh skill preview OWNER/REPO SKILL` before installation. `gh skill` is currently documented by GitHub CLI as a preview feature, so the delegated bot must check `gh skill --help` and confirm supported behavior on its installed version before use.

## pnpm news and automatic update policy

The official source is [pnpm/pnpm](https://github.com/pnpm/pnpm). After the version/lockfile mismatch is reconciled, the delegated bot checks stable pnpm releases weekly with `gh release list`/`gh release view`, sends release notes and compatibility findings, and may automatically prepare patch/minor updates on a dedicated branch. It updates `packageManager` and the lockfile together, runs the repository's declared validation, and reports the branch, diff, result, and rollback commit. Major releases, failed checks, missing validation, or changes to other dependencies are reported for operator decision. The bot never merges or deploys automatically.

## Refresh protocol

1. Fetch the intended Exoskeleton branch and record its exact commit. Refuse to operate on a dirty or divergent checkout unless the owner explicitly directs otherwise.
2. Enumerate all active manifests and lockfiles, including transitive lockfile entries. For every package, record ecosystem, declared/resolved version, direct/transitive status, official upstream GitHub URL (or `not hosted on GitHub`), license source, and update evidence. Do not guess repositories from package names. The inspected lockfile is incomplete, so this snapshot cannot enumerate resolved transitives; do not fabricate them.
3. Use authenticated, read-only `gh` queries for GitHub source and release metadata. Cache and select only required fields. Compare tags/releases and the default-branch commit against the pinned revision; a release tag is a candidate, not evidence of compatibility.
4. Report every candidate as one of: unchanged/current; compatible update candidate; breaking/major candidate; security advisory; archived/unmaintained; source/license ambiguity; manifest-lock mismatch; unsupported target; or validation failure. Include evidence, impact, download estimate, rollback path, and exact commands. Unknown or conflicting evidence means **blocked**, not pass.
5. Do not download release assets, install packages/skills, alter manifests or lockfiles, merge, publish, or deploy during discovery. After explicit approval, use the repository's package manager to resolve and install versions, then run the specified validation and prepare a reviewable patch.
6. Refresh this ledger from the resulting manifests and lockfiles only after the approved change is accepted. Preserve the prior ledger and lockfiles in version control for rollback.

## Low-bandwidth operating mode

- Schedule one metadata-only scan weekly on the authorized always-on runner (for example, the existing VPS), never on the phone's cellular connection by default.
- Use `gh api --cache 7d` where suitable, request only the default branch, latest relevant release/tag, and required source metadata, and serialize requests. Reuse the local ledger and lockfiles; do not clone repositories or download assets for routine discovery.
- Download package archives, source trees, or skill contents only after an approved update is selected. Report expected bytes before that stage where tooling exposes the size.
- This reduces transfer substantially but is **not zero-data or guaranteed unmetered**. GitHub API request quotas are separate from ISP/mobile data accounting. Run the bot over a connection whose billing terms are acceptable.

## Reproducible audit commands

```sh
git fetch origin
git rev-parse origin/main
git status --short --branch
gh auth status
gh repo view microsoft/TypeScript --json nameWithOwner,url,isArchived,licenseInfo
gh release list --repo microsoft/TypeScript --exclude-drafts --exclude-pre-releases --limit 5 --json tagName,publishedAt,isPrerelease
gh api repos/microsoft/TypeScript/commits/HEAD --cache 7d --jq '{sha:.sha, committedAt:.commit.committer.date}'
gh skill list --scope project --dir .agents/skills
```

The above are inventory examples, not a claim that an update scan, install, or dependency validation has passed. Roll back an approved documentation/skill change by reverting its commit; roll back package updates by restoring the reviewed prior manifest and lockfile revisions together, then rerunning the repository's declared validation.
