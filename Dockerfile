# ============================================================================
# Exoskeleton/Dockerfile
# ============================================================================
# Headless GitHub CLI Agent — Autonomous Runtime
#
# Python 3.12 + DuckDB + GitHub CLI + jq + curl
# No GUI. No interactive tools. No human gates.
# Runs on Kiri (2.55 ms container start through the Engine API) or any
# Docker-compatible runtime; Kiri serves the Docker Engine API unchanged.
#
# The agent is AUTONOMOUS:
#   - Self-authenticating (GH_TOKEN from env)
#   - Self-healing (restart: unless-stopped)
#   - Self-managing (auto-verify, auto-render, auto-index)
#   - Self-reporting (HTTP /health + /status endpoints)
# ============================================================================

FROM python:3.12-slim-bookworm

# ── Labels (OCI standard) ───────────────────────────────────────────────────
LABEL org.opencontainers.image.title="Headless GitHub CLI Agent"
LABEL org.opencontainers.image.description="Autonomous dependency indexer for the Exoskeleton. Queries GitHub via gh CLI, indexes into DuckDB, renders INDEX.md."
LABEL org.opencontainers.image.source="https://github.com/ingeniosity-A2A/Exoskeleton"
LABEL org.opencontainers.image.licenses="Apache-2.0"

# ── System packages ─────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    jq \
    bash \
    && rm -rf /var/lib/apt/lists/*

# ── GitHub CLI (official install) ──────────────────────────────────────────
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/* \
    && gh --version

# ── Python dependencies ────────────────────────────────────────────────────
COPY Dependencies/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# ── Create non-root user ────────────────────────────────────────────────────
RUN groupadd --gid 1000 agent \
    && useradd --uid 1000 --gid 1000 -m -s /bin/bash agent

# ── Copy agent code ────────────────────────────────────────────────────────
COPY --chown=agent:agent Dependencies/gh_headless_agent.py /app/gh_headless_agent.py
COPY --chown=agent:agent Dependencies/agent_loop.sh /app/agent_loop.sh
COPY --chown=agent:agent Dependencies/health_server.py /app/health_server.py
COPY --chown=agent:agent Memory/schemas/dependency_index.sql /schemas/dependency_index.sql

RUN chmod +x /app/agent_loop.sh

# ── Data directory (bind-mounted from the repo at runtime) ─────────────────
RUN mkdir -p /data /workspace && chown agent:agent /data /workspace

WORKDIR /app
USER agent

# ── Healthcheck (for Kiri's compose healthcheck) ───────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
    CMD curl -fsS http://localhost:9090/health || exit 1

# ── Entry point: start health server + agent loop ──────────────────────────
CMD ["bash", "-c", "python /app/health_server.py & bash /app/agent_loop.sh"]
