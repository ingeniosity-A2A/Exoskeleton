# MiMo-Bot

| File | Purpose |
|---|---|
| `collapsed_bot.py` | Collapsed bot — single-model inference for low-cost operations |
| `lead_selector.py` | Lead bot selector — chooses which interface leads per host profile |

## Lead Selection

> "Whichever interface has direct documentation knowledge is the lead."

The lead selector evaluates each host interface's documentation
completeness and assigns the lead role. The lead bot is the one
with direct knowledge — not the one with the most parameters.

## Host Profiles

| Profile | Host | Lead Interface |
|---|---|---|
| `s26_ultra_termux` | Samsung S26 Ultra (Termux) | Selects at runtime |
| `linux_vps` | Linux VPS | Selects at runtime |
| `gpu_compute_node` | GPU compute node | Selects at runtime |
