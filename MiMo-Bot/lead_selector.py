#!/usr/bin/env python3
"""
Exoskeleton/MiMo-Bot/lead_selector.py

Lead Bot Selector

"Whichever one has direct documentation knowledge is the lead bot."

The collapsed bot has three faces (CLI, MCP, API). For each dependency
on each host, one face becomes the LEAD — the one that has direct
documentation knowledge for that host.

This is host-aware:
  - S26 Ultra Termux:   CLI has the docs (termux man pages, --help)
  - Linux VPS:          API has the docs (OpenAPI specs, endpoint schemas)
  - GPU Compute Node:   MCP has the docs (tool schemas, model cards)

The selector evaluates documentation completeness and assigns the lead.
"""

import yaml
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional

HOST_PROFILES_DIR = Path(__file__).parent.parent / "Dependencies" / "host_profiles"


class Interface(Enum):
    CLI = "cli"
    API = "api"
    MCP = "mcp"


@dataclass
class InterfaceCandidate:
    interface: Interface
    has_documentation: bool
    docs_completeness: float  # 0.0 to 1.0
    docs_source: str  # where the docs live
    comm_protocol: str
    comm_endpoint: Optional[str]

    @property
    def lead_score(self) -> float:
        """
        Lead score: documentation knowledge is the primary factor.

        "Whichever one has direct documentation knowledge is the lead bot"

        Score = docs_completeness * 2.0 (dominant factor)
              + has_documentation * 1.0 (binary bonus)
              + interface_preference * 0.1 (tiebreaker)
        """
        pref = {
            Interface.CLI: 0.3,   # CLI has most direct host knowledge
            Interface.API: 0.2,
            Interface.MCP: 0.1,
        }.get(self.interface, 0.0)

        return (
            self.docs_completeness * 2.0
            + (1.0 if self.has_documentation else 0.0)
            + pref
        )


@dataclass
class LeadDecision:
    dependency: str
    host: str
    lead_interface: Interface
    reason: str
    score: float
    all_candidates: list[InterfaceCandidate]


class LeadSelector:
    """
    Evaluates which interface has direct documentation knowledge
    and assigns it as the lead bot for a given host.
    """

    def __init__(self, host_profile: str):
        self.host_profile = host_profile
        self.profile = self._load_profile(host_profile)

    def _load_profile(self, name: str) -> dict:
        path = HOST_PROFILES_DIR / f"{name}.yaml"
        if path.exists():
            return yaml.safe_load(path.read_text())
        return {
            "host": name,
            "preferred_comm": "websocket",
            "interface_priority": ["cli", "api", "mcp"],
        }

    def select_lead(
        self,
        dependency: str,
        candidates: list[InterfaceCandidate],
    ) -> LeadDecision:
        """
        Select the lead interface based on documentation knowledge.

        The interface with direct documentation knowledge WINS.
        If multiple have docs, the most complete wins.
        If none have docs, the host's preferred interface is the lead
        (but marked as documentation-unknown).
        """
        if not candidates:
            return LeadDecision(
                dependency=dependency,
                host=self.host_profile,
                lead_interface=Interface.CLI,
                reason="No candidates — default to CLI",
                score=0.0,
                all_candidates=[],
            )

        # Sort by lead score (documentation knowledge dominates)
        sorted_candidates = sorted(
            candidates, key=lambda c: c.lead_score, reverse=True
        )
        best = sorted_candidates[0]

        # Determine reason
        if best.has_documentation:
            reason = (
                f"Direct documentation knowledge: {best.docs_source} "
                f"(completeness: {best.docs_completeness:.0%})"
            )
        else:
            reason = (
                f"No interface has documentation. "
                f"Fallback to {best.interface.value} "
                f"(host preference: {self.profile.get('preferred_comm', 'websocket')})"
            )

        return LeadDecision(
            dependency=dependency,
            host=self.host_profile,
            lead_interface=best.interface,
            reason=reason,
            score=best.lead_score,
            all_candidates=sorted_candidates,
        )

    def evaluate_host_knowledge(
        self,
        dependency: str,
    ) -> dict[Interface, bool]:
        """
        Evaluate which interfaces have documentation knowledge for
        this dependency on this host.

        This is the core question: "Does this interface know how to
        use this dependency on THIS host?"
        """
        knowledge = {}

        # CLI knowledge: --help, man pages, termux availability
        knowledge[Interface.CLI] = self._cli_has_docs(dependency)

        # API knowledge: OpenAPI spec, endpoint schemas, health check
        knowledge[Interface.API] = self._api_has_docs(dependency)

        # MCP knowledge: tool schemas, model cards, resource descriptions
        knowledge[Interface.MCP] = self._mcp_has_docs(dependency)

        return knowledge

    def _cli_has_docs(self, dependency: str) -> bool:
        """Check if the CLI interface has direct documentation knowledge."""
        # On Termux/S26 Ultra: check if binary exists and has --help
        import shutil
        if shutil.which(dependency):
            return True
        # Check man pages
        import subprocess
        try:
            result = subprocess.run(
                ["man", "-w", dependency],
                capture_output=True, timeout=5,
            )
            return result.returncode == 0
        except Exception:
            return False

    def _api_has_docs(self, dependency: str) -> bool:
        """Check if the API interface has documentation (OpenAPI, etc.)."""
        # Check if API docs URL is configured in host profile
        api_deps = self.profile.get("api_dependencies", {})
        return dependency in api_deps

    def _mcp_has_docs(self, dependency: str) -> bool:
        """Check if the MCP interface has tool schemas/documentation."""
        mcp_deps = self.profile.get("mcp_dependencies", {})
        return dependency in mcp_deps


# ── Host Profile Files ─────────────────────────────────────────────────────

HOST_PROFILES = {
    "s26_ultra_termux": """
# S26 Ultra Termux Edge
host: s26_ultra_termux
preferred_comm: websocket
interface_priority:
  - cli    # Termux has direct CLI documentation (man, --help, pkg)
  - mcp    # MCP for model interaction
  - api    # API least documented on edge devices

# On this host, the CLI is the lead for most dependencies
# because Termux provides direct man pages and --help output.
cli_dependencies:
  - kiri
  - tailscale
  - duckdb
  - gh
  - git
  - python
  - rust

mcp_dependencies:
  - stanza
  - ollama

api_dependencies:
  - cloudflare
  - telnyx

network:
  tailscale: true
  termux_api: true
  battery_aware: true
  compute_budget: low
""",

    "linux_vps": """
# Linux VPS / Router
host: linux_vps
preferred_comm: tailnet
interface_priority:
  - api    # VPS has OpenAPI specs and endpoint schemas
  - cli    # CLI secondary
  - mcp    # MCP tertiary

api_dependencies:
  - nginx
  - cloudflare
  - telnyx
  - headscale

cli_dependencies:
  - tailscale
  - docker
  - kiri
  - gh
  - duckdb

mcp_dependencies:
  - stanza

network:
  tailscale: true
  headscale: true
  nginx: true
  compute_budget: medium
""",

    "gpu_compute_node": """
# GPU Compute Node
host: gpu_compute_node
preferred_comm: vsock
interface_priority:
  - mcp    # MCP has model cards and tool schemas
  - api    # API for inference endpoints
  - cli    # CLI for orchestration

mcp_dependencies:
  - stanza
  - ollama
  - vllm
  - tensorrt

api_dependencies:
  - nvidia-aerial
  - holoscan

cli_dependencies:
  - nvidia-smi
  - cuda
  - docker
  - kiri
  - gh

network:
  vsock: true
  gpu_direct: true
  compute_budget: high
""",
}


def write_host_profiles():
    """Write host profile YAML files."""
    HOST_PROFILES_DIR.mkdir(parents=True, exist_ok=True)
    for name, content in HOST_PROFILES.items():
        path = HOST_PROFILES_DIR / f"{name}.yaml"
        path.write_text(content.strip())
        print(f"Wrote {path}")


if __name__ == "__main__":
    write_host_profiles()
    print("\nLead selector ready.")
    print("Rule: Whichever interface has direct documentation knowledge is the lead bot.")
