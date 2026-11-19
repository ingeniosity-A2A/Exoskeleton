#!/usr/bin/env bash
# ============================================================================
# Exoskeleton/sandbox/opencode.sh
# ============================================================================
# OpenCode launcher. Drops into the sandbox with a prepared environment.
#
# Usage (from host):
#   kiri compose -f sandbox/docker-compose.yaml up -d
#   kiri compose -f sandbox/docker-compose.yaml exec exoskeleton-sandbox bash
#   # Inside the container:
#   /opt/exoskeleton/bin/opencode.sh
#
# Or via Makefile:
#   make -C sandbox opencode
# ============================================================================
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0;20m'

echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  OPENCODE SANDBOX SESSION${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}Available commands:${NC}"
echo ""
echo "    make help              Show all targets"
echo "    make kice-demo         KICE engine demo"
echo "    make kice-foil         9 adversarial foil tests"
echo "    make kice-benchmark    6-category benchmarks"
echo "    make kice-common-mode  Training overlap analysis"
echo "    make kice-budget       99%/1% budget profiler"
echo "    make kice-sovereign    Ava-007 authority demo"
echo "    make epistemic-gate    17 epistemic foil tests"
echo "    make benchmark-full    Full benchmark suite"
echo "    make status            System status"
echo ""
echo -e "  ${GREEN}Quick run:${NC}"
echo "    make kice-foil && make kice-budget && make status"
echo ""

exec bash
