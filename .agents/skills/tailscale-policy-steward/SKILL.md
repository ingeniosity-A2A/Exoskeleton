---
name: tailscale-policy-steward
description: Inspect and prepare Tailscale tailnet grant and routing-policy changes for the delegated network bot. Use whenever exit-node access, subnet routes, Tailscale grants/ACLs, HuJSON policy, or network authorization is involved.
---

# Tailscale Grant and HuJSON Stewardship

Read `docs/DEPENDENCY_LEDGER.md`, Exoskeleton's `AGENTS.md`, and the current Tailscale policy before proposing a change. The policy and current grants are the access-control source of truth. Machine-page labels such as “Exit Node allowed” do not prove that a client has policy permission to route internet traffic.

## Mandatory Grant gate

- **A Grant check is mandatory for every exit-node setup or access-policy change.** Inspect the current policy and determine whether an applicable grant/ACL already allows the intended client to use `autogroup:internet`.
- If a custom policy lacks the required internet destination permission, prepare the smallest grant that matches the operator-authorized client identity and intended exit-node path. Do not assume `autogroup:member`, all devices, or all exit nodes is acceptable. If the user/source selector or exit-node tag is unknown, stop and report the exact missing policy facts.
- If the existing policy already grants the required access, report the matching rule and make no duplicate grant. Tailscale grants are additive; adding another broad rule can widen access and does not subtract or narrow earlier grants.
- If only a specific exit node should be selectable, inspect whether the grant's `via` selector can safely scope it to the approved exit-node tag. Never invent or apply a tag without confirming it exists and is assigned to the intended node.
- Separate approval of an exit-node route in the admin console from the client’s access Grant. Verify both; neither substitutes for the other. Also verify the client selected the exit node and check public egress.

Tailscale documents that custom policies need an allow rule to `autogroup:internet` for exit-node use, and that a Grant without `via` makes every configured exit node available. The bot must assess those effects against the actual policy, not copy a broad sample blindly.

## Mandatory HuJSON implementation

- Use the official [tailscale/hujson](https://github.com/tailscale/hujson) Go library. Pin an exact version/commit and bundle it with the delegated network bot (or a version-pinned helper built into the bot package). A globally installed `hujsonfmt`, generic JSON parser, regex replacement, or remote runtime download is not an acceptable implementation.
- Parse, format, standardize, validate, and produce a structured diff with HuJSON-aware operations so comments and trailing commas are handled correctly.
- Reject invalid input. Keep a byte-for-byte rollback copy of the pre-change policy. Never discard comments without an explicit documented reason.
- HuJSON syntax validity is only the first check. Validate Tailscale policy fields/selectors, run the policy's test cases or supported policy-test tooling, verify the intended source-to-`autogroup:internet` permission, and check that no unrelated access was added by the grant union.
- Report the original and candidate policy hashes, the exact grant changed, test results, and rollback command. Do not include secrets or unrelated personal policy data in reports.

## Change boundary

- Discovery is read-only. During an approved change, retrieve the current policy, validate it, show the structured diff, and obtain explicit operator approval before applying it through Tailscale's supported policy interface.
- Do not edit Tailscale grants automatically as part of dependency updates, pnpm updates, route advertising, or release checks.
- Do not apply policy using the GitHub contents API unless the tailnet's actual policy source of truth is explicitly stored there and the operator has authorized that path.
- Never remove production nodes, alter unrelated grants, broaden ACLs for convenience, change DNS/firewall/routes, or deploy a policy based only on a generated example.
- If current policy access, authorized client identity, intended exit-node tag, or supported application path is unavailable, return `BLOCKED` with the missing item. Do not claim that a grant was updated.

## Evidence outcomes

Every run reports one of:

- `GRANT_PRESENT`: existing grant authorizes exactly the requested route; no policy mutation needed.
- `GRANT_MISSING`: the required access is absent; propose a minimal HuJSON patch and wait for approval.
- `GRANT_SCOPE_TOO_BROAD`: existing grant union authorizes more sources or exit nodes than requested; explain it and propose a separate reviewed narrowing plan. Do not claim that adding another Grant narrows access.
- `POLICY_INVALID` or `POLICY_TEST_FAILED`: no apply.
- `BLOCKED`: missing source policy, selector/tag identity, approval, parser, or supported apply interface.
- `APPLIED_AND_VERIFIED`: only after explicit approval, supported policy apply, server-side acceptance, and client egress verification.
