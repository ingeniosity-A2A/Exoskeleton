#!/usr/bin/env bash
# ============================================================================
# Exoskeleton/sandbox/run.sh
# ============================================================================
# Universal command executor. OpenCode calls this to run any sandbox command.
#
# Usage:
#   ./run.sh make kice-foil
#   ./run.sh make kice-benchmark
#   ./run.sh make status
#   ./run.sh python3 KICE/kice_schema.py --demo
#   ./run.sh bash -c "make kice-foil && make kice-budget"
# ============================================================================
set -euo pipefail

cd /opt/exoskeleton

# If no arguments, show help
if [ $# -eq 0 ]; then
    exec make help
fi

# Execute the command
exec "$@"
