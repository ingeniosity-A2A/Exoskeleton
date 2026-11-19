#!/usr/bin/env bash
# ============================================================================
# Exoskeleton/sandbox/entrypoint.sh
# ============================================================================
# Sandbox boot sequence. Runs on container start.
# ============================================================================
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0;20m'

echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  EXOSKELETON SANDBOX — Booting${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"

# ── Verify Python + DuckDB ─────────────────────────────────────────────────
echo -e "${CYAN}[*] Verifying Python...${NC}"
python3 --version
echo -e "${CYAN}[*] Verifying DuckDB...${NC}"
python3 -c "import duckdb; print(f'  DuckDB {duckdb.__version__}')"

# ── Verify GitHub CLI ──────────────────────────────────────────────────────
echo -e "${CYAN}[*] Verifying GitHub CLI...${NC}"
gh --version | head -1
if [ -n "${GH_TOKEN:-}" ]; then
    if gh auth status 2>/dev/null; then
        echo -e "${GREEN}[+] GitHub CLI authenticated.${NC}"
    else
        echo -e "${CYAN}[!] GitHub CLI token set but auth check failed.${NC}"
    fi
else
    echo -e "${CYAN}[!] No GH_TOKEN set. GitHub Agent will be limited.${NC}"
fi

# ── Verify KICE modules ────────────────────────────────────────────────────
echo -e "${CYAN}[*] Verifying KICE modules...${NC}"
for module in kice_schema kice_foil_tests kice_benchmark_suite compute_budget common_mode_analysis sovereign_authority; do
    if [ -f "/opt/exoskeleton/KICE/${module}.py" ]; then
        echo -e "  ${GREEN}✓${NC} ${module}.py"
    else
        echo -e "  ✗ ${module}.py MISSING"
    fi
done

# ── Verify Epistemic modules ───────────────────────────────────────────────
echo -e "${CYAN}[*] Verifying Epistemic modules...${NC}"
for module in benchmark_suite foil_tests epistemic_gates; do
    if [ -f "/opt/exoskeleton/Benchmarks/${module}.py" ]; then
        echo -e "  ${GREEN}✓${NC} ${module}.py"
    else
        echo -e "  ✗ ${module}.py MISSING"
    fi
done

echo ""
echo -e "${GREEN}[+] Sandbox ready.${NC}"
echo -e "${CYAN}    Run 'make help' for available commands.${NC}"
echo -e "${CYAN}    Or use: make -C /opt/exoskeleton <target>${NC}"
echo ""
