---
name: github-dependency-steward
description: Audit Exoskeleton package and skill dependencies against their official GitHub sources, report all update outcomes, and prepare approval-gated changes. Use for dependency inventory, update checks, skill provenance, lockfile drift, or supply-chain review.
---

# GitHub Dependency Steward

Read `docs/DEPENDENCY_LEDGER.md` first. The ledger names the inspected base commit, known lockfile blockers, source links, and required report fields. Reinspect the current target branch; never assume the ledger or local checkout is current.

## Role and authority

- Use `gh` as the authenticated, low-bandwidth interface for GitHub repository metadata, commits, releases, advisories, and GitHub-hosted skills.
- Use pnpm, Cargo, pip, or another declared ecosystem manager only for that ecosystem's dependency graph, resolution, installation, and lockfile. `gh` does not replace these tools.
- Rev.Ike is read-only: inspect, classify, and propose. It must not write a lockfile, install/update a skill, accept its own recommendation, authorize network or shell operations, or execute an update.
- The delegated maintenance bot may prepare evidence and a patch only within its granted scope. Require operator/Ava-007 approval before package/skill installation, version changes, merge, publication, or deployment.
- Never add tokens to files, command arguments, logs, or report output. Do not add GitHub Actions or a new always-on Exoskeleton daemon for this workflow.

## Audit procedure

1. Verify repository root, target branch, exact upstream SHA, dirty state, and `gh auth status`. Preserve all pre-existing work. Stop on an unreviewed dirty tree, stale base, or unexpected remote.
2. Enumerate active direct and transitive dependencies from every manifest and lockfile. Include project skills and their source repositories. Distinguish installed dependencies from unused catalogs, optional features, local packages, and platform-only dependencies.
3. Resolve each upstream URL from trustworthy package metadata or a manifest's source field; verify it with `gh repo view OWNER/REPO`. Record an explicit non-GitHub/unknown result when appropriate—never infer an official repo solely from a similar name.
4. For GitHub sources, use narrow authenticated `gh api` requests or `gh release list/view`; compare latest stable release, default-branch commit, existing pin, archived status, and available advisory/license evidence. A latest tag is only a candidate. Do not clone or fetch release assets during the inventory pass.
5. Classify every entry, not just the ones that changed:
   - unchanged/current;
   - compatible update candidate (still unverified until project validation);
   - breaking/major candidate;
   - vulnerability/security advisory;
   - archived, abandoned, or release-less;
   - official source, license, or provenance ambiguous;
   - manifest/lockfile/package-manager mismatch;
   - unsupported platform/runtime;
   - validation failure or missing validation evidence.
6. Fail closed on any source ambiguity, lock drift, missing license evidence, target incompatibility, or failed validation. Report the evidence and a bounded next step; do not silently select a replacement.
7. For a GitHub-hosted skill, run `gh skill preview OWNER/REPO SKILL` and inspect its full content, permissions, references, scripts, and license before proposing installation. Record repository, skill name, reviewed commit, and destination. Treat the `gh skill` command family as preview-versioned and check local help before relying on it. Do not run `gh skill update --all` unattended.
8. Return the full ledger delta and exact commands, including unchanged entries, what was not downloaded, bytes where known, risks, tests required, and rollback instructions. No “PASS” without reproducible validation output.

## Low-bandwidth GitHub checks

Use the ledger locally and request small metadata responses. Example:

```sh
gh repo view OWNER/REPO --json nameWithOwner,url,isArchived,licenseInfo
gh release list --repo OWNER/REPO --exclude-drafts --exclude-pre-releases --limit 5 --json tagName,publishedAt,isPrerelease
gh api repos/OWNER/REPO/commits/BRANCH --cache 7d --jq '{sha:.sha, date:.commit.committer.date}'
```

Use serial requests, a fixed weekly schedule on the authorized VPS/always-on runner, and `gh api --cache` for metadata. Do not poll from the S26's cellular connection by default. Do not download source archives, package tarballs, installers, or skill trees until an update is explicitly approved. This minimizes data; it cannot guarantee zero-metered network use.

## Update preparation after approval

- Reconfirm the approved repository SHA and scope.
- Use the ecosystem-native package manager to update only approved entries; review the complete manifest and lockfile diff.
- Verify signatures/checksums/attestations when available and record the result; never imply verification if upstream does not publish them.
- Run the exact checks from the current `AGENTS.md` and validation dock. Include target-platform builds where relevant.
- Present a reviewable patch and evidence. Stop before merge, publish, deploy, or any separately authorized production action.
