# ============================================================================
# Exoskeleton/sandbox/Dockerfile
# ============================================================================
# Exoskeleton Sandbox — All-in-One Runtime for OpenCode
#
# Contains:
#   - Python 3.12 + all dependencies
#   - GitHub CLI (headless)
#   - DuckDB 2.0
#   - KICE engine (schema, foil tests, benchmarks)
#   - Epistemic gates
#   - The_Beeper ingestion node
#   - Headless GitHub CLI Agent
#   - Compute budget profiler
#   - Common mode analyzer
#   - Sovereign authority
#
# OpenCode execs into this container and runs commands.
# ============================================================================
FROM python:3.12-slim-bookworm

LABEL org.opencontainers.image.title="Exoskeleton Sandbox"
LABEL org.opencontainers.image.description="Complete Exoskeleton + KICE runtime for OpenCode"

# ── System packages ─────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    jq \
    make \
    bash \
    git \
    zstd \
    procps \
    && rm -rf /var/lib/apt/lists/*

# ── GitHub CLI ─────────────────────────────────────────────────────────────
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/* \
    && gh --version

# ── Python dependencies (single install) ───────────────────────────────────
RUN pip install --no-cache-dir \
    duckdb>=2.0.0 \
    flask>=3.0 \
    flask-cors>=4.0 \
    requests>=2.31 \
    pyyaml>=6.0 \
    numpy>=1.26

# ── Create sandbox user ────────────────────────────────────────────────────
RUN groupadd --gid 1000 sandbox \
    && useradd --uid 1000 --gid 1000 -m -s /bin/bash sandbox

# ── Create directory structure ─────────────────────────────────────────────
RUN mkdir -p \
    /opt/exoskeleton/KICE \
    /opt/exoskeleton/Benchmarks \
    /opt/exoskeleton/Dependencies \
    /opt/exoskeleton/Sensory/The_Beeper \
    /opt/exoskeleton/A2A-Networks \
    /opt/exoskeleton/Memory/schemas \
    /opt/exoskeleton/Exoskeleton-Manifesto-Collection \
    /opt/exoskeleton/data \
    /opt/exoskeleton/logs \
    /opt/exoskeleton/bin \
    && chown -R sandbox:sandbox /opt/exoskeleton

# ── Copy code ──────────────────────────────────────────────────────────────
COPY --chown=sandbox:sandbox KICE/ /opt/exoskeleton/KICE/
COPY --chown=sandbox:sandbox Benchmarks/ /opt/exoskeleton/Benchmarks/
COPY --chown=sandbox:sandbox Dependencies/ /opt/exoskeleton/Dependencies/
COPY --chown=sandbox:sandbox Sensory/ /opt/exoskeleton/Sensory/
COPY --chown=sandbox:sandbox A2A-Networks/ /opt/exoskeleton/A2A-Networks/
COPY --chown=sandbox:sandbox Memory/ /opt/exoskeleton/Memory/

# ── Copy sandbox scripts ───────────────────────────────────────────────────
COPY --chown=sandbox:sandbox sandbox/entrypoint.sh /opt/exoskeleton/bin/entrypoint.sh
COPY --chown=sandbox:sandbox sandbox/run.sh /opt/exoskeleton/bin/run.sh
COPY --chown=sandbox:sandbox sandbox/opencode.sh /opt/exoskeleton/bin/opencode.sh
COPY --chown=sandbox:sandbox sandbox/Makefile /opt/exoskeleton/Makefile

RUN chmod +x /opt/exoskeleton/bin/*.sh

# ── Create universal Makefile (the main entry point) ────────────────────────
RUN cat > /opt/exoskeleton/Makefile << 'MAKEFILE_EOF'
# ============================================================================
# Exoskeleton Sandbox Makefile
# ============================================================================
# Universal command interface for OpenCode.
#
# Usage (from inside the sandbox):
#   make help              — Show all targets
#   make kice-demo         — Run KICE engine demo
#   make kice-foil         — Run 9 adversarial foil tests
#   make kice-benchmark    — Run 6-category benchmark suite
#   make kice-common-mode  — Run common mode analysis
#   make kice-budget       — Run 99%%/1%% compute budget profiler
#   make kice-sovereign    — Run Ava-007 sovereign authority demo
#   make epistemic-gate    — Run 17 epistemic foil tests
#   make benchmark-full    — Run full benchmark suite
#   make beeper-start      — Start The_Beeper ingestion node
#   make agent-start       — Start Headless GitHub CLI Agent
#   make status            — Show full system status
#   make shell             — Interactive bash
# ============================================================================
CYAN  := \033[0;36m
GREEN := \033[0;32m
ORANGE:= \033[0;33m
RED   := \033[0;31m
NC    := \033[0;20m
ROOT  := /opt/exoskeleton
PY    := python3
PIP   := pip3

.PHONY: help setup kice-demo kice-foil kice-benchmark kice-common-mode \
        kice-budget kice-sovereign epistemic-gate benchmark-full \
        beeper-start agent-start status shell health

help:
	@echo "$(CYAN)══════════════════════════════════════════════════════════════$(NC)"
	@echo "$(CYAN)  EXOSKELETON SANDBOX — Command Interface$(NC)"
	@echo "$(CYAN)══════════════════════════════════════════════════════════════$(NC)"
	@echo ""
	@echo "  $(GREEN)KICE Engine:$(NC)"
	@echo "    make kice-demo           Run KICE engine demo (4 models)"
	@echo "    make kice-foil           Run 9 adversarial foil tests"
	@echo "    make kice-benchmark      Run 6-category benchmark suite"
	@echo "    make kice-common-mode    Run training overlap analysis"
	@echo "    make kice-budget         Run 99%%/1%% compute budget profiler"
	@echo "    make kice-sovereign      Run Ava-007 sovereign authority demo"
	@echo ""
	@echo "  $(GREEN)Epistemic Gates:$(NC)"
	@echo "    make epistemic-gate      Run 17 epistemic foil tests"
	@echo "    make benchmark-full      Run full benchmark suite (merge config)"
	@echo ""
	@echo "  $(GREEN)Nodes:$(NC)"
	@echo "    make beeper-start        Start The_Beeper ingestion node"
	@echo "    make agent-start         Start Headless GitHub CLI Agent"
	@echo ""
	@echo "  $(GREEN)System:$(NC)"
	@echo "    make status              Full system status"
	@echo "    make health              Health check endpoint"
	@echo "    make shell               Interactive bash"
	@echo ""

setup:
	@echo "$(CYAN)[*] Setting up sandbox...$(NC)"
	@mkdir -p $(ROOT)/data $(ROOT)/logs
	@$(PIP) install -q duckdb flask flask-cors requests pyyaml numpy 2>/dev/null
	@echo "$(GREEN)[+] Sandbox ready.$(NC)"

# ── KICE Engine ────────────────────────────────────────────────────────────
kice-demo: setup
	@echo "$(CYAN)[*] Running KICE Engine demo...$(NC)"
	@cd $(ROOT)/KICE && $(PY) kice_schema.py --demo

kice-foil: setup
	@echo "$(CYAN)[*] Running KICE foil tests...$(NC)"
	@cd $(ROOT)/KICE && $(PY) -c "from kice_foil_tests import KICEFoilTestSuite; KICEFoilTestSuite().run_all()"

kice-benchmark: setup
	@echo "$(CYAN)[*] Running KICE benchmark suite...$(NC)"
	@cd $(ROOT)/KICE && $(PY) kice_benchmark_suite.py

kice-common-mode: setup
	@echo "$(CYAN)[*] Running common mode analysis...$(NC)"
	@cd $(ROOT)/KICE && $(PY) common_mode_analysis.py

kice-budget: setup
	@echo "$(CYAN)[*] Running compute budget profiler...$(NC)"
	@cd $(ROOT)/KICE && $(PY) compute_budget.py

kice-sovereign: setup
	@echo "$(CYAN)[*] Running sovereign authority demo...$(NC)"
	@cd $(ROOT)/KICE && $(PY) sovereign_authority.py

# ── Epistemic Gates ────────────────────────────────────────────────────────
epistemic-gate: setup
	@echo "$(CYAN)[*] Running epistemic foil tests...$(NC)"
	@cd $(ROOT)/Benchmarks && $(PY) foil_tests.py

benchmark-full: setup
	@echo "$(CYAN)[*] Running full benchmark suite...$(NC)"
	@cd $(ROOT)/Benchmarks && $(PY) benchmark_suite.py

# ── Nodes ──────────────────────────────────────────────────────────────────
beeper-start: setup
	@echo "$(CYAN)[*] Starting The_Beeper ingestion node...$(NC)"
	@cd $(ROOT)/Sensory/The_Beeper && $(PY) server.py &

agent-start: setup
	@echo "$(CYAN)[*] Starting Headless GitHub CLI Agent...$(NC)"
	@cd $(ROOT)/Dependencies && $(PY) gh_headless_agent.py run

# ── System ─────────────────────────────────────────────────────────────────
status:
	@echo "$(CYAN)══════════════════════════════════════════════════════════════$(NC)"
	@echo "$(CYAN)  EXOSKELETON SANDBOX STATUS$(NC)"
	@echo "$(CYAN)══════════════════════════════════════════════════════════════$(NC)"
	@echo ""
	@echo "  Python:    $$($(PY) --version 2>&1)"
	@echo "  DuckDB:    $$($(PY) -c 'import duckdb; print(duckdb.__version__)' 2>&1)"
	@echo "  gh:        $$(gh --version 2>&1 | head -1)"
	@echo "  jq:        $$(jq --version 2>&1)"
	@echo ""
	@echo "  KICE:"
	@ls $(ROOT)/KICE/*.py 2>/dev/null | while read f; do echo "    $$(basename $$f)"; done
	@echo ""
	@echo "  Benchmarks:"
	@ls $(ROOT)/Benchmarks/*.py 2>/dev/null | while read f; do echo "    $$(basename $$f)"; done
	@echo ""
	@echo "  Sensory:"
	@ls $(ROOT)/Sensory/The_Beeper/*.py 2>/dev/null | while read f; do echo "    $$(basename $$f)"; done
	@echo ""
	@echo "  Dependencies:"
	@ls $(ROOT)/Dependencies/*.py 2>/dev/null | while read f; do echo "    $$(basename $$f)"; done
	@echo ""

health:
	@echo '{"status":"healthy","sandbox":"exoskeleton","ts":"'$$ (date -u +%Y-%m-%dT%H:%M:%SZ)'"}' | $(PY) -m json.tool

shell:
	@exec /bin/bash
MAKEFILE_EOF

# ── Health server (port 9099) ──────────────────────────────────────────────
RUN cat > /opt/exoskeleton/bin/health_server.py << 'PYEOF'
import json
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({
            "status": "healthy",
            "sandbox": "exoskeleton",
            "mode": "opencode",
            "ts": datetime.now(timezone.utc).isoformat(),
        }).encode())

    def log_message(self, *a):
        pass

if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 9099), Handler).serve_forever()
PYEOF

WORKDIR /opt/exoskeleton
USER sandbox
EXPOSE 9099
CMD ["bash", "-c", "python3 /opt/exoskeleton/bin/health_server.py & exec bash"]
