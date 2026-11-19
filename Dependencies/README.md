# Dependencies — Headless GitHub CLI Agent

> "The Exoskeleton does not hoard static prose. It maintains one
> index sheet and delegates retrieval to the Headless GitHub CLI
> Agent."

Autonomous dependency indexing into DuckDB 2.0. No interactive
prompts. Structured JSON output. Self-healing.

## Components

| File | Purpose |
|---|---|
| `gh_headless_agent.py` | Main agent — queries GitHub, indexes DuckDB, renders INDEX.md |
| `agent_loop.sh` | Autonomous loop with exponential backoff |
| `health_server.py` | HTTP health/status endpoint (port 9090) |
| `requirements.txt` | Python dependencies |
| `host_profiles/` | Host-aware routing profiles |

## Headless Configuration

| Variable | Value | Purpose |
|---|---|---|
| `GH_TOKEN` | PAT | Authentication (bypasses interactive login) |
| `GH_PROMPT_DISABLED` | `true` | Fail fast, no hanging |
| `GH_NO_UPDATE_NOTIFIER` | `true` | Clean logs |
| `NO_COLOR` | `1` | Plain stdout for agent loop |
| `GIT_TERMINAL_PROMPT` | `0` | No git credential prompts |

## CLI

```bash
python3 gh_headless_agent.py run          # One autonomous cycle
python3 gh_headless_agent.py status       # Status (JSON)
python3 gh_headless_agent.py render       # Render INDEX.md
python3 gh_headless_agent.py register     # Register a dependency
python3 gh_headless_agent.py verify       # Verify from GitHub
python3 gh_headless_agent.py search "q"   # Search repos
python3 gh_headless_agent.py issues o r   # List issues
python3 gh_headless_agent.py prs o r      # List PRs
python3 gh_headless_agent.py audit        # Audit ledger
python3 gh_headless_agent.py auth         # Check auth
```

## DuckDB Schema

See `Memory/schemas/dependency_index.sql` for the full schema:

- `dependencies` — Registered dependencies
- `dependency_versions` — Version history
- `host_interfaces` — Host-aware interfaces (lead selection)
- `dep_audit_ledger` — Cryptographic audit chain
- Views: `v_dependency_index`, `v_green_band`, `v_orange_band`, `v_lead_candidates`
