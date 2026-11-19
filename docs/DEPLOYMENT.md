# Deployment

## Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| Kiri | latest | Container runtime (or Docker) |
| Python | 3.12+ | Runtime |
| GitHub CLI (`gh`) | latest | Headless GitHub operations |
| DuckDB | 2.0+ | Dependency index + memory |
| make | any | Orchestration |
| GH_TOKEN | PAT | GitHub authentication (repo + read:org scopes) |

## Option 1: Sandbox (Recommended)

One container. Everything inside. OpenCode execs into it.

```bash
# Clone and enter
cd Exoskeleton

# Set your GitHub token
export GH_TOKEN=ghp_your_token_here

# Start the sandbox
make -C sandbox up

# Drop in
make -C sandbox opencode

# Run the full suite
make kice-foil && make kice-budget && make status
```

## Option 2: Kiri Compose (Full Stack)

All three planes running as separate services.

```bash
cd Exoskeleton

# Set environment
export GH_TOKEN=ghp_your_token_here

# Start everything
kiri compose up -d

# Verify
curl http://agent.exoskeleton.kiri.localhost/status
curl http://beeper.exoskeleton.kiri.localhost/status

# Follow logs
kiri compose logs -f

# Tear down
kiri compose down
```

## Option 3: The_Beeper Standalone

Just the Sensory Capability Node.

```bash
cd Sensory/The_Beeper

# Kiri Compose
make sandbox-up

# Or directly
make start
make status
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GH_TOKEN` | Yes | — | GitHub Personal Access Token |
| `AGENT_MODE` | No | `autonomous` | Agent operating mode |
| `AGENT_POLL_INTERVAL` | No | `300` | Seconds between cycles |
| `HOST_PROFILE` | No | `any` | Host-aware routing profile |
| `NODE_NAME` | No | `The_Beeper` | Sensory node identity |
| `REMOTE_CORE` | No | `100.129.159.107` | OCI Core Anchor IP |
| `AUTO_PUSH_REPLICA` | No | `true` | Auto-push replica to remote |
| `EPISTEMIC_GATE` | No | `true` | Enforce epistemic gate on sync |

## Health Checks

| Endpoint | Port | Purpose |
|---|---|---|
| `GET /health` | 9090 | GitHub Agent health |
| `GET /health` | 8080 | The_Beeper health |
| `GET /health` | 9099 | Sandbox health |
| `GET /health` | 9999 | DuckDB health |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `gh not authenticated` | Set `GH_TOKEN` in environment or `.env` |
| `duckdb not found` | `pip install duckdb>=2.0.0` |
| `KICE IS COMPROMISED` | Fix the failing foil test before proceeding |
| `Gate integrity: COMPROMISED` | Run `make epistemic-gate` to diagnose |
| Container won't start | `kiri compose logs` for details |
