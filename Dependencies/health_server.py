#!/usr/bin/env python3
"""
Exoskeleton/Dependencies/health_server.py

Autonomous Health & Status Server for the Headless GitHub CLI Agent.

Runs on port 9090. Serves:
  GET /health  — 200 OK for Kiri's compose healthcheck
  GET /status  — Full agent status (JSON), read from DuckDB
  GET /audit   — Audit ledger (JSON)

Lightweight. No framework. stdlib only (plus duckdb, which the agent
already depends on).

The server never crashes the container: a missing or locked database is
reported as degraded health with the reason, so the operator sees why
instead of a silent restart loop.
"""

import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

PORT = int(os.environ.get("AGENT_HEALTH_PORT", "9090"))

DUCKDB_PATH = Path(os.environ.get(
    "DUCKDB_PATH",
    os.environ.get(
        "LIBRARIAN_DB",
        str(Path(__file__).resolve().parent / "dependency_index.db"),
    ),
))

AGENT_MODE = os.environ.get("AGENT_MODE", "autonomous")
AGENT_POLL_INTERVAL = int(os.environ.get("AGENT_POLL_INTERVAL", "300"))
AGENT_SELF_HEAL = os.environ.get("AGENT_SELF_HEAL", "true") == "true"

AGENT_START_TIME = datetime.now(timezone.utc)


def _uptime() -> float:
    return (datetime.now(timezone.utc) - AGENT_START_TIME).total_seconds()


def _connect():
    import duckdb

    return duckdb.connect(str(DUCKDB_PATH), read_only=True)


def agent_status() -> dict:
    """Read live counts from the DuckDB dependency index."""
    status = {
        "agent": "headless-github-cli-agent",
        "mode": AGENT_MODE,
        "autonomous": True,
        "self_heal": AGENT_SELF_HEAL,
        "poll_interval": AGENT_POLL_INTERVAL,
        "database": str(DUCKDB_PATH),
        "database_present": DUCKDB_PATH.exists(),
        "uptime_seconds": round(_uptime(), 3),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if not DUCKDB_PATH.exists():
        status.update({"state": "degraded", "reason": "index missing", "dependencies": 0})
        return status

    try:
        conn = _connect()
        try:
            total = conn.execute("SELECT COUNT(*) FROM dependencies").fetchone()[0]
            green = conn.execute("SELECT COUNT(*) FROM v_green_band").fetchone()[0]
            orange = conn.execute("SELECT COUNT(*) FROM v_orange_band").fetchone()[0]
            leads = conn.execute(
                "SELECT COUNT(*) FROM host_interfaces WHERE is_lead"
            ).fetchone()[0]
        finally:
            conn.close()
        status.update({
            "state": "healthy",
            "dependencies": total,
            "green_band": green,
            "orange_band": orange,
            "lead_bots": leads,
        })
    except Exception as exc:  # never let status reporting kill the container
        status.update({"state": "degraded", "reason": str(exc), "dependencies": 0})

    return status


def audit_entries(limit: int = 50) -> dict:
    """Read the audit ledger."""
    if not DUCKDB_PATH.exists():
        return {"count": 0, "entries": [], "reason": "index missing"}
    try:
        conn = _connect()
        try:
            rows = conn.execute(
                """
                SELECT event_id, dependency_id, action, details, event_hash, event_time
                FROM dep_audit_ledger ORDER BY event_id DESC LIMIT ?
                """,
                [limit],
            ).fetchall()
        finally:
            conn.close()
        entries = [
            {
                "event_id": r[0],
                "dependency_id": r[1],
                "action": r[2],
                "details": r[3],
                "hash": r[4],
                "time": str(r[5]),
            }
            for r in rows
        ]
        return {"count": len(entries), "entries": entries}
    except Exception as exc:
        return {"count": 0, "entries": [], "reason": str(exc)}


class HealthHandler(BaseHTTPRequestHandler):
    server_version = "ExoskeletonAgent/0.1"

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            status = agent_status()
            # Healthy transport even when the index is missing: the container
            # is up and reporting, which is what the compose check asks.
            self._json(200, {
                "status": "healthy",
                "state": status["state"],
                "agent": status["agent"],
                "uptime_seconds": status["uptime_seconds"],
            })

        elif self.path == "/status":
            self._json(200, agent_status())

        elif self.path == "/audit":
            self._json(200, {"action": "audit", **audit_entries()})

        else:
            self._json(404, {"error": "not found", "paths": ["/health", "/status", "/audit"]})

    def log_message(self, fmt, *args):  # keep container logs structured
        print(json.dumps({
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": "info",
            "agent": "health-server",
            "msg": fmt % args,
        }), flush=True)


def main() -> None:
    server = HTTPServer(("0.0.0.0", PORT), HealthHandler)
    print(json.dumps({
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": "info",
        "agent": "health-server",
        "msg": f"listening on 0.0.0.0:{PORT}",
        "db": str(DUCKDB_PATH),
    }), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
