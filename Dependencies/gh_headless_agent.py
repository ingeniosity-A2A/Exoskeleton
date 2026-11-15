#!/usr/bin/env python3
"""
Exoskeleton/Dependencies/gh_headless_agent.py

Headless GitHub CLI Agent — AUTONOMOUS

RENAMED from gh_headless_librarian.py.
"Headless Librarian" → "Headless GitHub CLI Agent"

Autonomous operation:
  - No human gates
  - Self-authenticating (GH_TOKEN from env)
  - Self-healing (restart: unless-stopped in compose)
  - Self-managing (auto-verify, auto-render, auto-index)
  - Self-reporting (HTTP /health + /status via health_server.py)

Headless configuration (enforced at module level):
  GH_TOKEN              : Authentication (bypasses gh auth login)
  GH_PROMPT_DISABLED    : Fail fast instead of hanging
  GH_NO_UPDATE_NOTIFIER : Clean logs
  NO_COLOR              : Plain stdout for agent loop parsing
  GIT_TERMINAL_PROMPT   : No git credential prompts

All gh commands use --json for structured output.
All output is machine-parseable. No human-readable tables.

"The Exoskeleton does not hoard static prose. It maintains one index
 sheet and delegates retrieval to the Headless GitHub CLI Agent."
"""

import json
import hashlib
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ── Enforce headless environment BEFORE anything else ───────────────────────

os.environ.setdefault("GH_PROMPT_DISABLED", "true")
os.environ.setdefault("GH_NO_UPDATE_NOTIFIER", "true")
os.environ.setdefault("NO_COLOR", "1")
os.environ.setdefault("GIT_TERMINAL_PROMPT", "0")

try:
    import duckdb
except ImportError:
    print("FATAL: duckdb is required. pip install duckdb", file=sys.stderr)
    sys.exit(1)


# ── Paths ──────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get(
    "DUCKDB_PATH",
    os.environ.get("LIBRARIAN_DB", str(REPO_ROOT / "Dependencies" / "dependency_index.db")),
))
SCHEMA_PATH = Path(os.environ.get(
    "SCHEMA_PATH",
    "/schemas/dependency_index.sql",
))
INDEX_RENDER = Path(os.environ.get(
    "INDEX_PATH",
    "/data/INDEX.md",
))

# ── Agent State ─────────────────────────────────────────────────────────────

AGENT_MODE = os.environ.get("AGENT_MODE", "autonomous")
AGENT_POLL_INTERVAL = int(os.environ.get("AGENT_POLL_INTERVAL", "300"))
AGENT_AUTO_VERIFY = os.environ.get("AGENT_AUTO_VERIFY", "true") == "true"
AGENT_AUTO_RENDER = os.environ.get("AGENT_AUTO_RENDER", "true") == "true"
AGENT_SELF_HEAL = os.environ.get("AGENT_SELF_HEAL", "true") == "true"
AGENT_LOG_LEVEL = os.environ.get("AGENT_LOG_LEVEL", "info")

# ── Structured Logging ─────────────────────────────────────────────────────

def log(level: str, message: str, **kwargs):
    """Structured JSON logging for agent loops."""
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "agent": "headless-github-cli-agent",
        "msg": message,
    }
    entry.update(kwargs)
    levels = {"debug": 0, "info": 1, "warn": 2, "error": 3}
    if levels.get(level, 0) >= levels.get(AGENT_LOG_LEVEL, 1):
        print(json.dumps(entry), flush=True)


# ── Headless gh Wrapper ─────────────────────────────────────────────────────

def gh_api(endpoint: str, fields: Optional[dict] = None) -> dict:
    """
    Call `gh api` with headless configuration.

    - Uses GH_TOKEN from env (no interactive login)
    - Returns structured JSON (no terminal formatting)
    - Fails fast on errors (no prompts, no retries)
    """
    cmd = ["gh", "api", endpoint, "--header", "Accept: application/vnd.github+json"]

    if fields:
        for key, value in fields.items():
            cmd.extend(["--field", f"{key}={value}"])

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            env={**os.environ},
        )
        if result.returncode != 0:
            raise RuntimeError(f"gh api {endpoint} failed (rc={result.returncode}): {result.stderr.strip()}")
        return json.loads(result.stdout)
    except FileNotFoundError:
        raise RuntimeError("GitHub CLI (gh) not found in container.")
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"gh api {endpoint} timed out (30s)")


def gh_search_repos(query: str, limit: int = 10) -> list[dict]:
    """Search GitHub repositories via `gh search repos --json`."""
    cmd = [
        "gh", "search", "repos", query,
        "--json", "name,owner,url,description,stargazerCount,updatedAt,licenseInfo",
        "--limit", str(limit),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            raise RuntimeError(f"gh search failed: {result.stderr.strip()}")
        return json.loads(result.stdout)
    except FileNotFoundError:
        raise RuntimeError("GitHub CLI (gh) not found.")


def gh_search_code(query: str, limit: int = 5) -> list[dict]:
    """Search GitHub code via `gh search code --json`."""
    cmd = [
        "gh", "search", "code", query,
        "--json", "path,repository,url,textMatches",
        "--limit", str(limit),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return []
        return json.loads(result.stdout)
    except Exception:
        return []


def gh_repo_info(owner: str, repo: str) -> dict:
    """Get repository metadata via `gh api`."""
    return gh_api(f"repos/{owner}/{repo}")


def gh_repo_latest_release(owner: str, repo: str) -> Optional[dict]:
    """Get the latest release via `gh api`."""
    try:
        return gh_api(f"repos/{owner}/{repo}/releases/latest")
    except RuntimeError:
        return None


def gh_repo_issues(
    owner: str, repo: str,
    label: Optional[str] = None, state: str = "open", limit: int = 20,
) -> list[dict]:
    """List repository issues via `gh issue list --json`."""
    cmd = [
        "gh", "issue", "list",
        "--repo", f"{owner}/{repo}",
        "--state", state,
        "--json", "number,title,body,labels,createdAt,updatedAt",
        "--limit", str(limit),
    ]
    if label:
        cmd.extend(["--label", label])
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return []
        return json.loads(result.stdout)
    except Exception:
        return []


def gh_repo_prs(
    owner: str, repo: str,
    state: str = "open", limit: int = 20,
) -> list[dict]:
    """List repository PRs via `gh pr list --json`."""
    cmd = [
        "gh", "pr", "list",
        "--repo", f"{owner}/{repo}",
        "--state", state,
        "--json", "number,title,body,labels,createdAt,updatedAt,headRefName",
        "--limit", str(limit),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return []
        return json.loads(result.stdout)
    except Exception:
        return []


def gh_auth_status() -> dict:
    """Check authentication status (headless).

    Not every gh build supports `--json` on `auth status`, so fall back to
    the plain command and read its exit code instead of reporting a usage
    error as "unauthenticated".
    """
    try:
        result = subprocess.run(
            ["gh", "auth", "status", "--json", "hosts"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError:
                return {"authenticated": True, "detail": result.stdout.strip()}
        if "unknown flag" not in result.stderr and "unknown shorthand" not in result.stderr:
            return {"authenticated": False, "error": result.stderr.strip()}

        # Older gh: no --json support on this subcommand.
        plain = subprocess.run(
            ["gh", "auth", "status"],
            capture_output=True, text=True, timeout=10,
        )
        detail = (plain.stdout or plain.stderr).strip().splitlines()
        return {"authenticated": plain.returncode == 0, "detail": detail[:1]}
    except Exception as e:
        return {"authenticated": False, "error": str(e)}


# ── Content Hash ───────────────────────────────────────────────────────────

def content_hash(name: str, version: str, github_url: str) -> str:
    payload = f"{name}:{version}:{github_url}".encode()
    return hashlib.blake2b(payload, digest_size=32).hexdigest()


# ── DuckDB Operations ──────────────────────────────────────────────────────

def connect() -> "duckdb.DuckDBPyConnection":
    """Open the DuckDB 2.0 dependency index database."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = duckdb.connect(str(DB_PATH))
    if SCHEMA_PATH.exists():
        conn.execute(SCHEMA_PATH.read_text())
    else:
        log("warn", "Schema not found, using defaults", path=str(SCHEMA_PATH))
    return conn


def register_dependency(
    conn: "duckdb.DuckDBPyConnection",
    name: str,
    version: str,
    github_url: str,
    comm_protocol: str = "websocket",
    comm_endpoint: Optional[str] = None,
    exposes_mcp: bool = False,
    exposes_api: bool = False,
    exposes_cli: bool = False,
    has_direct_docs: bool = False,
    lead_interface: Optional[str] = None,
    host_profile: str = "any",
    epistemic_state: str = "OBSERVED",
    verification_method: str = "gh_api",
) -> int:
    chash = content_hash(name, version, github_url)
    now = datetime.now(timezone.utc).isoformat()

    conn.execute("""
        INSERT INTO dependencies
            (name, version, github_url, comm_protocol, comm_endpoint,
             exposes_mcp, exposes_api, exposes_cli,
             has_direct_docs, lead_interface, host_profile,
             epistemic_state, verified_at, verification_method, content_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (name) DO UPDATE SET
            version = EXCLUDED.version,
            github_url = EXCLUDED.github_url,
            comm_protocol = EXCLUDED.comm_protocol,
            comm_endpoint = EXCLUDED.comm_endpoint,
            exposes_mcp = EXCLUDED.exposes_mcp,
            exposes_api = EXCLUDED.exposes_api,
            exposes_cli = EXCLUDED.exposes_cli,
            has_direct_docs = EXCLUDED.has_direct_docs,
            lead_interface = EXCLUDED.lead_interface,
            host_profile = EXCLUDED.host_profile,
            epistemic_state = EXCLUDED.epistemic_state,
            verified_at = EXCLUDED.verified_at,
            verification_method = EXCLUDED.verification_method,
            content_hash = EXCLUDED.content_hash,
            updated_at = now()
    """, [
        name, version, github_url, comm_protocol, comm_endpoint,
        exposes_mcp, exposes_api, exposes_cli,
        has_direct_docs, lead_interface, host_profile,
        epistemic_state, now, verification_method, chash,
    ])

    dep_id = conn.execute(
        "SELECT id FROM dependencies WHERE name = ?", [name]
    ).fetchone()[0]

    conn.execute("""
        INSERT INTO dependency_versions
            (dependency_id, version, is_current, discovered_via, discovered_at)
        VALUES (?, ?, TRUE, ?, ?)
    """, [dep_id, version, verification_method, now])

    _audit(conn, dep_id, "registered", f"{name}@{version} via {verification_method}")
    log("info", "Dependency registered", name=name, version=version, epistemic=epistemic_state)
    return dep_id


def verify_from_gh(
    conn: "duckdb.DuckDBPyConnection",
    owner: str,
    repo: str,
    comm_protocol: str = "websocket",
    comm_endpoint: Optional[str] = None,
    exposes_mcp: bool = False,
    exposes_api: bool = False,
    exposes_cli: bool = False,
    has_direct_docs: bool = False,
    host_profile: str = "any",
) -> int:
    """Verify a dependency from live GitHub data (headless, autonomous)."""
    info = gh_repo_info(owner, repo)
    release = gh_repo_latest_release(owner, repo)

    name = info["name"]
    version = release["tag_name"] if release else info.get("default_branch", "main")
    github_url = info["html_url"]

    return register_dependency(
        conn,
        name=name,
        version=version,
        github_url=github_url,
        comm_protocol=comm_protocol,
        comm_endpoint=comm_endpoint,
        exposes_mcp=exposes_mcp,
        exposes_api=exposes_api,
        exposes_cli=exposes_cli,
        has_direct_docs=has_direct_docs,
        host_profile=host_profile,
        epistemic_state="OBSERVED",
        verification_method="gh_api",
    )


def render_index_md(conn: "duckdb.DuckDBPyConnection") -> str:
    """Render INDEX.md from the DuckDB 2.0 dependency index."""
    rows = conn.execute("SELECT * FROM v_dependency_index").fetchall()
    cols = [desc[0] for desc in conn.description]

    lines = [
        "# Exoskeleton Dependency Index",
        "",
        "> **This file is a RENDER. The source of truth is `Dependencies/dependency_index.db` (DuckDB 2.0).**",
        "> Regenerated automatically by the Headless GitHub CLI Agent.",
        "",
        f"> Generated: {datetime.now(timezone.utc).isoformat()}",
        f"> Dependencies: {len(rows)}",
        f"> Mode: {AGENT_MODE}",
        "",
        "## Index",
        "",
        "| " + " | ".join(cols) + " |",
        "|" + "|".join(["---"] * len(cols)) + "|",
    ]
    for row in rows:
        lines.append("| " + " | ".join(str(v) for v in row) + " |")

    lead_rows = conn.execute("SELECT * FROM v_lead_candidates").fetchall()
    if lead_rows:
        lines.extend([
            "",
            "## Lead Bots",
            "",
            "*(Whichever interface has direct documentation knowledge is the lead)*",
            "",
            "| Dependency | Host | Interface | Docs Completeness | Lead |",
            "|---|---|---|---|---|",
        ])
        for row in lead_rows:
            lines.append(
                f"| {row[0]} | {row[2]} | {row[3]} | {row[5]:.0%} | {'✓' if row[6] else ''} |"
            )

    orange = conn.execute("SELECT COUNT(*) FROM v_orange_band").fetchone()[0]
    green = conn.execute("SELECT COUNT(*) FROM v_green_band").fetchone()[0]
    lines.extend([
        "",
        "## Epistemic Status",
        "",
        f"- **Green Band** (verified): {green} dependencies",
        f"- **Orange Band** (unverified): {orange} dependencies",
        "",
        "---",
        "",
        "*Headless GitHub CLI Agent · Exoskeleton Manifesto Collection*",
    ])

    return "\n".join(lines)


def audit(conn: "duckdb.DuckDBPyConnection") -> list[dict]:
    rows = conn.execute("""
        SELECT event_id, dependency_id, action, details, event_hash, event_time
        FROM dep_audit_ledger ORDER BY event_id DESC LIMIT 50
    """).fetchall()
    return [
        {"event_id": r[0], "dependency_id": r[1], "action": r[2],
         "details": r[3], "hash": r[4], "time": r[5]}
        for r in rows
    ]


def _audit(conn, dep_id, action, details):
    prev = conn.execute(
        "SELECT event_hash FROM dep_audit_ledger ORDER BY event_id DESC LIMIT 1"
    ).fetchone()
    prev_hash = prev[0] if prev else "genesis"
    event_id = conn.execute(
        "SELECT COALESCE(MAX(event_id), 0) + 1 FROM dep_audit_ledger"
    ).fetchone()[0]
    event_hash = hashlib.blake2b(
        f"{event_id}:{action}:{details}:{prev_hash}".encode(), digest_size=32
    ).hexdigest()
    conn.execute("""
        INSERT INTO dep_audit_ledger (event_id, dependency_id, action, details, prev_hash, event_hash)
        VALUES (?, ?, ?, ?, ?, ?)
    """, [event_id, dep_id, action, details, prev_hash, event_hash])


# ── Autonomous Operations ──────────────────────────────────────────────────

def autonomous_verify_cycle(conn: "duckdb.DuckDBPyConnection") -> dict:
    """
    One autonomous verification cycle.

    1. Read all registered dependencies from DuckDB
    2. Query GitHub for latest versions (gh api, headless)
    3. Update index with OBSERVED data
    4. Render INDEX.md
    5. Report status

    No human gates. No prompts. Fully autonomous.
    """
    results = {"verified": 0, "updated": 0, "errors": 0, "rendered": False}

    # Preflight: without auth every gh call silently looks like "no release",
    # which would report an autonomous cycle as clean while verifying nothing.
    auth = gh_auth_status()
    if not auth.get("authenticated", False):
        log("error", "GitHub authentication unavailable; skipping verification",
            detail=auth.get("error") or auth.get("detail"))
        results["errors"] += 1
        rows: list = []
    else:
        try:
            rows = conn.execute("SELECT name, github_url FROM dependencies").fetchall()
        except Exception as e:
            log("error", "Failed to read dependencies", error=str(e))
            results["errors"] += 1
            return results

    for name, github_url in rows:
        try:
            # Parse owner/repo from GitHub URL
            path = github_url.replace("https://github.com/", "").rstrip("/")
            if "/" not in path:
                continue
            owner, repo = path.split("/", 1)

            # Query GitHub for latest release
            release = gh_repo_latest_release(owner, repo)
            if release:
                latest = release["tag_name"]
                current = conn.execute(
                    "SELECT version FROM dependencies WHERE name = ?", [name]
                ).fetchone()

                if current and current[0] != latest:
                    log("info", "Version update detected",
                        name=name, current=current[0], latest=latest)
                    verify_from_gh(conn, owner, repo)
                    results["updated"] += 1
                else:
                    log("debug", "Up to date", name=name, version=current[0] if current else "?")
                    results["verified"] += 1

        except Exception as e:
            log("warn", "Verify failed", name=name, error=str(e))
            results["errors"] += 1

    # Auto-render INDEX.md
    if AGENT_AUTO_RENDER:
        try:
            md = render_index_md(conn)
            INDEX_RENDER.write_text(md)
            results["rendered"] = True
            log("info", "INDEX.md rendered", bytes=len(md))
        except Exception as e:
            log("error", "Render failed", error=str(e))

    return results


def autonomous_status(conn: "duckdb.DuckDBPyConnection") -> dict:
    """Get agent status for the health endpoint."""
    try:
        total = conn.execute("SELECT COUNT(*) FROM dependencies").fetchone()[0]
        green = conn.execute("SELECT COUNT(*) FROM v_green_band").fetchone()[0]
        orange = conn.execute("SELECT COUNT(*) FROM v_orange_band").fetchone()[0]
        leads = conn.execute("SELECT COUNT(*) FROM host_interfaces WHERE is_lead").fetchone()[0]
    except Exception:
        total = green = orange = leads = 0

    return {
        "agent": "headless-github-cli-agent",
        "mode": AGENT_MODE,
        "autonomous": True,
        "self_heal": AGENT_SELF_HEAL,
        "dependencies": total,
        "green_band": green,
        "orange_band": orange,
        "lead_bots": leads,
        "database": str(DB_PATH),
        "poll_interval": AGENT_POLL_INTERVAL,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── CLI Entry Point ────────────────────────────────────────────────────────

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Headless GitHub CLI Agent (autonomous, non-interactive)"
    )
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("run", help="Run one autonomous cycle")

    sub.add_parser("render", help="Render INDEX.md")

    reg = sub.add_parser("register", help="Register a dependency")
    reg.add_argument("name")
    reg.add_argument("version")
    reg.add_argument("github_url")
    reg.add_argument("--comm", default="websocket")
    reg.add_argument("--endpoint", default=None)
    reg.add_argument("--mcp", action="store_true")
    reg.add_argument("--api", action="store_true")
    reg.add_argument("--cli", action="store_true")
    reg.add_argument("--docs", action="store_true")
    reg.add_argument("--host", default="any")
    reg.add_argument("--epistemic", default="OBSERVED",
                     choices=["OBSERVED", "DERIVED", "INFERRED", "HYPOTHESIZED"])

    ver = sub.add_parser("verify", help="Verify from GitHub (headless)")
    ver.add_argument("owner")
    ver.add_argument("repo")
    ver.add_argument("--comm", default="websocket")
    ver.add_argument("--endpoint", default=None)
    ver.add_argument("--mcp", action="store_true")
    ver.add_argument("--api", action="store_true")
    ver.add_argument("--cli", action="store_true")
    ver.add_argument("--docs", action="store_true")
    ver.add_argument("--host", default="any")

    srch = sub.add_parser("search", help="Search GitHub repos")
    srch.add_argument("query")
    srch.add_argument("--limit", type=int, default=10)

    issues = sub.add_parser("issues", help="List issues")
    issues.add_argument("owner")
    issues.add_argument("repo")
    issues.add_argument("--label", default=None)
    issues.add_argument("--state", default="open")
    issues.add_argument("--limit", type=int, default=20)

    prs = sub.add_parser("prs", help="List PRs")
    prs.add_argument("owner")
    prs.add_argument("repo")
    prs.add_argument("--state", default="open")
    prs.add_argument("--limit", type=int, default=20)

    sub.add_parser("audit", help="Show audit ledger")
    sub.add_parser("status", help="Show status")
    sub.add_parser("auth", help="Check auth")

    args = parser.parse_args()
    conn = connect()
    exit_code = 0

    if args.command == "run":
        results = autonomous_verify_cycle(conn)
        print(json.dumps({"action": "run", "results": results}, indent=2))
        # A cycle that verified nothing must fail loudly so agent_loop.sh
        # backs off instead of logging a clean run.
        exit_code = 0 if results["errors"] == 0 else 1

    elif args.command == "render":
        md = render_index_md(conn)
        INDEX_RENDER.write_text(md)
        print(json.dumps({"action": "render", "path": str(INDEX_RENDER), "bytes": len(md)}))

    elif args.command == "register":
        dep_id = register_dependency(
            conn, name=args.name, version=args.version,
            github_url=args.github_url, comm_protocol=args.comm,
            comm_endpoint=args.endpoint, exposes_mcp=args.mcp,
            exposes_api=args.api, exposes_cli=args.cli,
            has_direct_docs=args.docs, host_profile=args.host,
            epistemic_state=args.epistemic, verification_method="manual",
        )
        print(json.dumps({"action": "register", "id": dep_id, "name": args.name}))

    elif args.command == "verify":
        dep_id = verify_from_gh(
            conn, owner=args.owner, repo=args.repo,
            comm_protocol=args.comm, comm_endpoint=args.endpoint,
            exposes_mcp=args.mcp, exposes_api=args.api,
            exposes_cli=args.cli, has_direct_docs=args.docs,
            host_profile=args.host,
        )
        print(json.dumps({"action": "verify", "id": dep_id}))

    elif args.command == "search":
        results = gh_search_repos(args.query, args.limit)
        print(json.dumps({"action": "search", "results": results}, indent=2))

    elif args.command == "issues":
        results = gh_repo_issues(args.owner, args.repo, args.label, args.state, args.limit)
        print(json.dumps({"action": "issues", "count": len(results), "issues": results}, indent=2))

    elif args.command == "prs":
        results = gh_repo_prs(args.owner, args.repo, args.state, args.limit)
        print(json.dumps({"action": "prs", "count": len(results), "prs": results}, indent=2))

    elif args.command == "audit":
        entries = audit(conn)
        print(json.dumps({"action": "audit", "count": len(entries), "entries": entries}, indent=2))

    elif args.command == "status":
        status = autonomous_status(conn)
        print(json.dumps({"action": "status", **status}, indent=2))

    elif args.command == "auth":
        status = gh_auth_status()
        print(json.dumps({"action": "auth", "status": status}, indent=2))

    else:
        parser.print_help()

    conn.close()
    if exit_code:
        sys.exit(exit_code)


if __name__ == "__main__":
    main()
