# A2A-Networks — Transport Fabric

> "Encapsulates the full networking and telecommunications mesh
> under one roof: Tailscale, Headscale, Tailcat, Rustunnel, NGINX,
> DuckDB, Cloudflare, Kiri (in Docker), and Telnyx."

## Components

| File | Purpose |
|---|---|
| `mesh_controller.py` | rustunnel orchestrator + health monitor + telemetry capture |
| `sync_bridge.py` | DuckDB Short-Term → Long-Term Lake with epistemic gate |
| `telnyx_bridge.py` | Telnyx telecommunications integration |

## Data Flow

```
The_Beeper (Orange Band)
       │
       ▼
  sync_bridge.py
       │ epistemic gate:
       │   OBSERVED  → ✓ synced
       │   DERIVED   → ✓ synced
       │   INFERRED  → ✗ BLOCKED
       │   HYPOTHESIZED → ✗ BLOCKED
       ▼
Long-Term Lake (Green Band)
```

## Epistemic Gate Rule

> "Short-term memory is for speed. The Long-Term Lake is for
> verified truth. The Doctrinal Gate stands between them."

INFERRED and HYPOTHESIZED events stay in the Orange Band where
they belong. Only OBSERVED and DERIVED events cross the gate.
