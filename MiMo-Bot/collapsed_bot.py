#!/usr/bin/env python3
"""
Exoskeleton/MiMo-Bot/collapsed_bot.py

Collapsed Headless Bot

CLI + MCP + API → Single host-aware bot.

"CLI commands, Model Context Protocol (MCP) tools, and REST/WebSocket API
 endpoints are collapsed into one unified headless bot binary/daemon rather
 than three separate wrapper layers."

"Host-Aware Dependency Dataset Routing: Depending on the host environment
 where the bot wakes up (S26 Ultra Termux Edge, Linux VPS/Router, or GPU
 Compute Node), one of the three interfaces (CLI, MCP, or API) carries the
 extensive dependency dataset knowledge for that host and routes execution
 accordingly."

Mimo-Agent codes. ava007-coder oversees.
"""

import json
import os
import platform
import sys
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional

from lead_selector import Interface, LeadSelector, InterfaceCandidate


class HostEnvironment(Enum):
    S26_ULTRA_TERMUX = "s26_ultra_termux"
    LINUX_VPS = "linux_vps"
    GPU_COMPUTE_NODE = "gpu_compute_node"
    UNKNOWN = "unknown"


class CommProtocol(Enum):
    WEBSOCKET = "websocket"
    GRPC = "grpc"
    HTTP = "http"
    SSH = "ssh"
    VSOCK = "vsock"
    UNIX_SOCKET = "unix-socket"
    MQTT = "mqtt"
    QUIC = "quic"
    TAILNET = "tailnet"


@dataclass
class DependencyRoute:
    name: str
    version: str
    github_url: str
    comm_protocol: CommProtocol
    comm_endpoint: Optional[str]
    lead_interface: Interface
    exposed_interfaces: list[Interface]
    host: HostEnvironment
    epistemic_state: str  # OBSERVED, DERIVED, INFERRED, HYPOTHESIZED


@dataclass
class BotState:
    host: HostEnvironment
    routes: dict[str, DependencyRoute] = field(default_factory=dict)
    lead_decisions: dict[str, str] = field(default_factory=dict)
    active_interface: Optional[Interface] = None


def detect_host() -> HostEnvironment:
    """
    Detect the host environment where the bot wakes up.

    "Depending on the host environment where the bot wakes up..."
    """
    # Termux on Android
    if os.environ.get("TERMUX_VERSION") or os.path.exists("/data/data/com.termux"):
        return HostEnvironment.S26_ULTRA_TERMUX

    # GPU Compute Node (NVIDIA GPU present)
    if os.path.exists("/dev/nvidia0") or os.path.exists("/proc/driver/nvidia/version"):
        return HostEnvironment.GPU_COMPUTE_NODE

    # Linux VPS (generic Linux with systemd)
    system = platform.system()
    if system == "Linux":
        # Check for VPS indicators
        if os.path.exists("/etc/systemd/system") and not os.path.exists("/dev/nvidia0"):
            return HostEnvironment.LINUX_VPS

    return HostEnvironment.UNKNOWN


class CollapsedBot:
    """
    The unified headless bot.

    Three faces (CLI, MCP, API) collapsed into one daemon.
    Host-aware: the face with direct documentation knowledge leads.
    """

    def __init__(self):
        self.host = detect_host()
        self.state = BotState(host=self.host)
        self.selector = LeadSelector(self.host.value)

        # Load dependency routes from DuckDB 2.0
        self._load_routes()

        # Determine the active interface (the lead for this host)
        self._determine_active_interface()

    def _load_routes(self):
        """
        Load dependency routes from the DuckDB 2.0 dependency index.

        "DEPENDENCY INDEX LIVES IN DUCKDB 2.0"
        """
        try:
            import duckdb
            db_path = (
                Path(__file__).parent.parent
                / "Dependencies" / "dependency_index.db"
            )
            if db_path.exists():
                conn = duckdb.connect(str(db_path), read_only=True)
                rows = conn.execute("""
                    SELECT name, version, github_url,
                           comm_protocol, comm_endpoint,
                           lead_interface, host_profile, epistemic_state
                    FROM dependencies
                    WHERE host_profile IN (?, 'any')
                """, [self.host.value]).fetchall()

                for row in rows:
                    route = DependencyRoute(
                        name=row[0],
                        version=row[1],
                        github_url=row[2],
                        comm_protocol=CommProtocol(row[3]),
                        comm_endpoint=row[4],
                        lead_interface=Interface(row[5] or "cli"),
                        exposed_interfaces=self._parse_interfaces(row[0]),
                        host=self.host,
                        epistemic_state=row[7],
                    )
                    self.state.routes[route.name] = route

                conn.close()
        except ImportError:
            # DuckDB not available — use fallback
            self._load_fallback_routes()

    def _load_fallback_routes(self):
        """Fallback dependency routes (hardcoded for bootstrap)."""
        fallback = {
            "kiri": ("0.1.0", "https://github.com/libracoder/kiri"),
            "tailscale": ("1.14.2", "https://github.com/tailscale/tailscale"),
            "duckdb": ("2.0.0", "https://github.com/duckdb/duckdb"),
            "gh": ("2.62.0", "https://github.com/cli/cli"),
            "stanza": ("1.9.0", "https://github.com/stanfordnlp/stanza"),
        }
        for name, (version, url) in fallback.items():
            self.state.routes[name] = DependencyRoute(
                name=name,
                version=version,
                github_url=url,
                comm_protocol=CommProtocol.WEBSOCKET,
                comm_endpoint=None,
                lead_interface=Interface.CLI,
                exposed_interfaces=[Interface.CLI, Interface.API],
                host=self.host,
                epistemic_state="DERIVED",
            )

    def _parse_interfaces(self, dep_name: str) -> list[Interface]:
        """Parse which interfaces a dependency exposes."""
        # This would come from the DuckDB exposes_mcp/api/cli columns
        return [Interface.CLI, Interface.API, Interface.MCP]

    def _determine_active_interface(self):
        """
        Determine which interface is the ACTIVE lead for this host.

        "Whichever one has direct documentation knowledge is the lead bot"

        For each dependency, evaluate which interface has documentation.
        The most common lead interface becomes the bot's active face.
        """
        lead_counts = {Interface.CLI: 0, Interface.API: 0, Interface.MCP: 0}

        for name, route in self.state.routes.items():
            candidates = [
                InterfaceCandidate(
                    interface=iface,
                    has_documentation=self._check_docs(name, iface),
                    docs_completeness=self._docs_completeness(name, iface),
                    docs_source=f"{name}-{iface.value}",
                    comm_protocol=route.comm_protocol.value,
                    comm_endpoint=route.comm_endpoint,
                )
                for iface in route.exposed_interfaces
            ]

            decision = self.selector.select_lead(name, candidates)
            self.state.lead_decisions[name] = decision.lead_interface.value
            lead_counts[decision.lead_interface] += 1

        # The most common lead becomes the bot's active interface
        self.state.active_interface = max(lead_counts, key=lead_counts.get)

    def _check_docs(self, dep_name: str, iface: Interface) -> bool:
        """Check if an interface has direct documentation knowledge."""
        knowledge = self.selector.evaluate_host_knowledge(dep_name)
        return knowledge.get(iface, False)

    def _docs_completeness(self, dep_name: str, iface: Interface) -> float:
        """Estimate documentation completeness (0.0 to 1.0)."""
        if not self._check_docs(dep_name, iface):
            return 0.0
        # Simple heuristic: CLI docs are usually most complete on edge
        if self.host == HostEnvironment.S26_ULTRA_TERMUX:
            return {
                Interface.CLI: 0.9,
                Interface.API: 0.3,
                Interface.MCP: 0.5,
            }.get(iface, 0.0)
        elif self.host == HostEnvironment.GPU_COMPUTE_NODE:
            return {
                Interface.CLI: 0.5,
                Interface.API: 0.7,
                Interface.MCP: 0.9,
            }.get(iface, 0.0)
        else:
            return {
                Interface.CLI: 0.6,
                Interface.API: 0.9,
                Interface.MCP: 0.5,
            }.get(iface, 0.0)

    # ── Unified Interface (CLI + MCP + API collapsed) ─────────────────────

    def execute(self, command: str, **kwargs) -> dict[str, Any]:
        """
        Execute a command through the collapsed bot.

        The command is routed to the appropriate interface based on
        the lead decision for the target dependency.
        """
        parts = command.split(".", 1)
        if len(parts) != 2:
            return {"error": "Command format: <dependency>.<action>"}

        dep_name, action = parts

        if dep_name not in self.state.routes:
            return {"error": f"Unknown dependency: {dep_name}"}

        route = self.state.routes[dep_name]
        lead = Interface(self.state.lead_decisions.get(dep_name, "cli"))

        return {
            "status": "routed",
            "dependency": dep_name,
            "version": route.version,
            "action": action,
            "lead_interface": lead.value,
            "comm_protocol": route.comm_protocol.value,
            "host": self.host.value,
            "epistemic_state": route.epistemic_state,
            "note": (
                f"Routed to {lead.value} (lead has direct documentation "
                f"knowledge for {self.host.value})"
            ),
        }

    def status(self) -> dict[str, Any]:
        """Bot status report."""
        return {
            "host": self.host.value,
            "active_interface": (
                self.state.active_interface.value
                if self.state.active_interface
                else None
            ),
            "dependencies": len(self.state.routes),
            "lead_decisions": self.state.lead_decisions,
            "routes": {
                name: {
                    "version": r.version,
                    "comm": r.comm_protocol.value,
                    "lead": self.state.lead_decisions.get(name),
                    "epistemic": r.epistemic_state,
                }
                for name, r in self.state.routes.items()
            },
        }


from pathlib import Path


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Collapsed Headless Bot")
    parser.add_argument("command", nargs="?", help="dependency.action")
    parser.add_argument("--status", action="store_true")
    args = parser.parse_args()

    bot = CollapsedBot()

    if args.status:
        print(json.dumps(bot.status(), indent=2))
    elif args.command:
        result = bot.execute(args.command)
        print(json.dumps(result, indent=2))
    else:
        # Default: show status
        print(json.dumps(bot.status(), indent=2))


if __name__ == "__main__":
    main()
