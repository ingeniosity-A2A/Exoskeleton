# ============================================================================
# Exoskeleton/sandbox/Makefile
# ============================================================================
# Host-side orchestration for the Exoskeleton Sandbox.
#
# Usage (from the Exoskeleton/ root):
#   make -C sandbox up              # Start the sandbox
#   make -C sandbox opencode        # Drop into the sandbox
#   make -C sandbox run CMD="make kice-foil"
#   make -C sandbox kice-foil       # Run foil tests directly
#   make -C sandbox down            # Tear down
# ============================================================================

CYAN  := \033[0;36m
GREEN := \033[0;32m
ORANGE:= \033[0;33m
RED   := \033[0;31m
NC    := \033[0;20m

COMPOSE_FILE := docker-compose.yaml
COMPOSE      := kiri compose -f $(COMPOSE_FILE)
CONTAINER    := exoskeleton-sandbox

.PHONY: up down build opencode run shell logs status health clean \
        kice-demo kice-foil kice-benchmark kice-common-mode kice-budget \
        kice-sovereign epistemic-gate benchmark-full help

# ── Lifecycle ───────────────────────────────────────────────────────────────
up:
	@echo "$(CYAN)[*] Starting Exoskeleton Sandbox...$(NC)"
	$(COMPOSE) up -d --build
	@echo "$(GREEN)[+] Sandbox running: http://sandbox.exoskeleton.kiri.localhost$(NC)"
	@echo "$(GREEN)[+] Run 'make opencode' to drop in.$(NC)"

down:
	@echo "$(ORANGE)[*] Stopping sandbox...$(NC)"
	$(COMPOSE) down
	@echo "$(RED)[-] Sandbox stopped.$(NC)"

build:
	@echo "$(CYAN)[*] Building sandbox image...$(NC)"
	$(COMPOSE) build

logs:
	@$(COMPOSE) logs -f

# ── OpenCode Interface ─────────────────────────────────────────────────────
opencode:
	@echo "$(CYAN)[*] Dropping into sandbox...$(NC)"
	$(COMPOSE) exec $(CONTAINER) bash /opt/exoskeleton/bin/opencode.sh

shell:
	@$(COMPOSE) exec $(CONTAINER) bash

run:
	@$(COMPOSE) exec $(CONTAINER) bash /opt/exoskeleton/bin/run.sh $(CMD)

# ── KICE Commands (run from host, execute inside container) ────────────────
kice-demo:
	@$(COMPOSE) exec $(CONTAINER) make kice-demo

kice-foil:
	@$(COMPOSE) exec $(CONTAINER) make kice-foil

kice-benchmark:
	@$(COMPOSE) exec $(CONTAINER) make kice-benchmark

kice-common-mode:
	@$(COMPOSE) exec $(CONTAINER) make kice-common-mode

kice-budget:
	@$(COMPOSE) exec $(CONTAINER) make kice-budget

kice-sovereign:
	@$(COMPOSE) exec $(CONTAINER) make kice-sovereign

epistemic-gate:
	@$(COMPOSE) exec $(CONTAINER) make epistemic-gate

benchmark-full:
	@$(COMPOSE) exec $(CONTAINER) make benchmark-full

# ── System ─────────────────────────────────────────────────────────────────
status:
	@$(COMPOSE) exec $(CONTAINER) make status

health:
	@curl -fsS http://localhost:9099/health | jq .

clean:
	@echo "$(ORANGE)[*] Cleaning sandbox...$(NC)"
	$(COMPOSE) down -v
	@echo "$(GREEN)[+] Cleaned.$(NC)"

help:
	@echo "$(CYAN)══════════════════════════════════════════════════════════════$(NC)"
	@echo "$(CYAN)  EXOSKELETON SANDBOX — Host Commands$(NC)"
	@echo "$(CYAN)══════════════════════════════════════════════════════════════$(NC)"
	@echo ""
	@echo "  $(GREEN)Lifecycle:$(NC)"
	@echo "    make up              Start the sandbox"
	@echo "    make down            Stop the sandbox"
	@echo "    make build           Rebuild the image"
	@echo "    make logs            Follow logs"
	@echo "    make clean           Stop + remove volumes"
	@echo ""
	@echo "  $(GREEN)OpenCode:$(NC)"
	@echo "    make opencode        Drop into sandbox shell"
	@echo "    make shell           Drop into bash"
	@echo "    make run CMD=\"...\"   Run any command inside"
	@echo ""
	@echo "  $(GREEN)KICE:$(NC)"
	@echo "    make kice-demo       KICE engine demo"
	@echo "    make kice-foil       9 adversarial foil tests"
	@echo "    make kice-benchmark  6-category benchmarks"
	@echo "    make kice-common-mode  Training overlap analysis"
	@echo "    make kice-budget     99%%/1%% budget profiler"
	@echo "    make kice-sovereign  Ava-007 authority demo"
	@echo ""
	@echo "  $(GREEN)Epistemic:$(NC)"
	@echo "    make epistemic-gate  17 epistemic foil tests"
	@echo "    make benchmark-full  Full benchmark suite"
	@echo ""
	@echo "  $(GREEN)System:$(NC)"
	@echo "    make status          System status"
	@echo "    make health          Health check"
	@echo ""
