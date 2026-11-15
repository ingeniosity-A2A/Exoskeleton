#!/usr/bin/env bash
# ============================================================================
# Exoskeleton/Dependencies/agent_loop.sh
# ============================================================================
# Autonomous loop for the Headless GitHub CLI Agent.
#
# Each cycle runs one full pass: read the index, verify versions from GitHub,
# update OBSERVED records, render INDEX.md. A failed cycle never kills the
# loop — restart: unless-stopped in compose plus this retry is the
# self-healing half of autonomous mode.
#
# Environment:
#   AGENT_POLL_INTERVAL  seconds between cycles        (default 300)
#   AGENT_MAX_CYCLES     stop after N cycles, 0 = ∞     (default 0)
#   AGENT_SCRIPT         agent entry point              (default /app/gh_headless_agent.py)
#   AGENT_PYTHON         interpreter                    (default python)
# ============================================================================

set -uo pipefail

INTERVAL="${AGENT_POLL_INTERVAL:-300}"
MAX_CYCLES="${AGENT_MAX_CYCLES:-0}"
SCRIPT="${AGENT_SCRIPT:-/app/gh_headless_agent.py}"
PYTHON="${AGENT_PYTHON:-python}"

log() {
    printf '{"ts":"%s","level":"%s","agent":"agent-loop","msg":"%s"}\n' \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${1:-info}" "${2:-}"
}

log info "loop starting (interval=${INTERVAL}s, max_cycles=${MAX_CYCLES})"

cycle=0
while :; do
    cycle=$((cycle + 1))
    log info "cycle ${cycle} start"

    if "$PYTHON" "$SCRIPT" run; then
        log info "cycle ${cycle} ok"
    else
        rc=$?
        # Back off on failure instead of hammering GitHub.
        log warn "cycle ${cycle} failed (rc=${rc}); backing off"
        sleep "$(( INTERVAL < 30 ? INTERVAL : 30 ))"
    fi

    if [ "$MAX_CYCLES" -gt 0 ] && [ "$cycle" -ge "$MAX_CYCLES" ]; then
        log info "max cycles reached (${MAX_CYCLES}); exiting"
        break
    fi

    sleep "$INTERVAL"
done
