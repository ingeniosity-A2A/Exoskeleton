#!/usr/bin/env python3
"""Reproducible Exoskeleton kinetic-intelligence preflight, test and benchmark runner.

Uses only the Python standard library. Optional integrations are detected and
reported honestly; this runner never fabricates retrieval scores or downloads
models/datasets implicitly.
"""
from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import os
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_ROOT = ROOT / "artifacts" / "kinetic"


def command_version(command: str, args: list[str] | None = None) -> str | None:
    exe = shutil.which(command)
    if not exe:
        return None
    try:
        p = subprocess.run([exe, *(args or ["--version"])], capture_output=True,
                           text=True, timeout=20, check=False)
        return (p.stdout or p.stderr).strip().splitlines()[0][:300]
    except Exception as exc:
        return f"ERROR: {exc}"


def run_step(name: str, argv: list[str], cwd: Path, timeout: int = 1800) -> dict:
    started = time.monotonic()
    try:
        p = subprocess.run(argv, cwd=cwd, capture_output=True, text=True,
                           timeout=timeout, check=False)
        return {
            "name": name, "status": "passed" if p.returncode == 0 else "failed",
            "returncode": p.returncode, "elapsed_seconds": round(time.monotonic()-started, 3),
            "command": argv, "stdout": p.stdout[-30000:], "stderr": p.stderr[-30000:],
        }
    except FileNotFoundError:
        return {"name": name, "status": "blocked", "reason": f"executable not found: {argv[0]}",
                "command": argv, "elapsed_seconds": round(time.monotonic()-started, 3)}
    except subprocess.TimeoutExpired as exc:
        return {"name": name, "status": "timeout", "command": argv,
                "elapsed_seconds": round(time.monotonic()-started, 3),
                "stdout": (exc.stdout or b"").decode(errors="replace")[-10000:] if isinstance(exc.stdout, bytes) else str(exc.stdout or "")[-10000:],
                "stderr": (exc.stderr or b"").decode(errors="replace")[-10000:] if isinstance(exc.stderr, bytes) else str(exc.stderr or "")[-10000:]}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", choices=("core", "full"), default="full")
    parser.add_argument("--skip-bench", action="store_true")
    parser.add_argument("--skip-js", action="store_true")
    parser.add_argument("--corpus", type=Path, default=None,
                        help="Optional local corpus path; no corpus is downloaded.")
    args = parser.parse_args()

    run_id = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    outdir = ARTIFACT_ROOT / run_id
    outdir.mkdir(parents=True, exist_ok=True)
    env = {
        "timestamp_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "run_id": run_id, "git_commit": None,
        "platform": platform.platform(), "machine": platform.machine(),
        "processor": platform.processor(), "python": sys.version,
        "tools": {name: command_version(name) for name in ("git", "rustc", "cargo", "node", "pnpm", "duckdb")},
        "optional_python_modules": {
            name: bool(importlib.util.find_spec(name))
            for name in ("duckdb", "docling", "turbovec", "torch", "transformers", "huggingface_hub")
        },
        "corpus": str(args.corpus.resolve()) if args.corpus else os.environ.get("KINETIC_CORPUS"),
    }
    git = shutil.which("git")
    if git:
        p = subprocess.run([git, "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True)
        if p.returncode == 0:
            env["git_commit"] = p.stdout.strip()

    steps: list[dict] = []
    cargo_manifest = ROOT / "packages" / "substrate-native" / "Cargo.toml"
    steps.append(run_step("rust_format_check", ["cargo", "fmt", "--manifest-path", str(cargo_manifest), "--", "--check"], ROOT, 300))
    steps.append(run_step("rust_tests", ["cargo", "test", "--manifest-path", str(cargo_manifest), "--lib", "--features", "turbovec"], ROOT, 1800))
    if not args.skip_bench:
        steps.append(run_step("rust_substrate_bench", ["cargo", "bench", "--manifest-path", str(cargo_manifest), "--bench", "substrate", "--features", "turbovec"], ROOT, 1800))
        steps.append(run_step("rust_turbovec_bench", ["cargo", "bench", "--manifest-path", str(cargo_manifest), "--bench", "turbovec", "--features", "turbovec"], ROOT, 1800))

    if not args.skip_js:
        if shutil.which("pnpm"):
            steps.append(run_step("pnpm_build", ["pnpm", "build"], ROOT, 1200))
            steps.append(run_step("pnpm_typecheck", ["pnpm", "typecheck"], ROOT, 1200))
        else:
            steps.append({"name": "javascript_workspace", "status": "blocked", "reason": "pnpm not installed"})

    if env["optional_python_modules"]["duckdb"]:
        schemas = [
            ROOT / "packages" / "memory-chassis" / "src" / "schema_20.sql",
            ROOT / "packages" / "memory-chassis" / "src" / "schema_kinetic.sql",
            ROOT / "packages" / "memory-chassis" / "src" / "schema_tween_atom.sql",
        ]
        code = (
            "import duckdb,sys; "
            "c=duckdb.connect(':memory:'); "
            "print('duckdb_version='+duckdb.__version__); "
            "[(c.execute(open(p,encoding='utf-8').read()),print('schema_apply=PASS:'+p)) for p in sys.argv[1:]]"
        )
        steps.append(run_step("duckdb_all_memory_schemas", [sys.executable, "-c", code, *map(str, schemas)], ROOT, 300))
    else:
        steps.append({"name": "duckdb_all_memory_schemas", "status": "blocked",
                      "reason": "Python duckdb module not installed; install the pinned DuckDB 2.0 runtime before applying schema_20.sql, schema_kinetic.sql and schema_tween_atom.sql."})

    if args.profile == "full":
        for module, label in (("docling", "docling_tableformer_ingestion"),
                              ("turbovec", "turbovec_retrieval")):
            if env["optional_python_modules"][module]:
                steps.append({"name": label, "status": "available_not_executed",
                              "reason": "Module import availability is not an integration test. Corpus/model adapter and ground-truth suite must be configured."})
            else:
                steps.append({"name": label, "status": "blocked",
                              "reason": f"Python module '{module}' is not installed; no synthetic retrieval score will be generated."})
        if args.corpus or env["corpus"]:
            corpus = Path(args.corpus or env["corpus"]).expanduser()
            steps.append({"name": "corpus_manifest", "status": "available" if corpus.exists() else "blocked",
                          "path": str(corpus), "reason": None if corpus.exists() else "corpus path does not exist"})
        else:
            steps.append({"name": "corpus_manifest", "status": "blocked",
                          "reason": "Set KINETIC_CORPUS or pass --corpus to a pinned local corpus."})
        steps.append({"name": "rustunnel_transport", "status": "blocked",
                      "reason": "Set KINETIC_RUSTUNNEL_URL to a controlled test endpoint and provide a non-secret health-check contract; no tunnel is presumed active."})
        steps.append({"name": "huggingface_acquisition", "status": "not_run",
                      "reason": "No implicit model downloads. Pin repo/revision/files and run acquisition separately with scoped credentials."})
        steps.append({"name": "five_g_edge_path", "status": "not_run",
                      "reason": "Requires device-side RF/modem telemetry and an identified edge endpoint; emulation must be labeled separately."})
        steps.append({"name": "dfm_parametric_model", "status": "not_run",
                      "reason": "Existing Rust DFM module is promotion metadata, not the trained DFM neural architecture."})
        steps.append({"name": "holographic_memory", "status": "not_run",
                      "reason": "No specific holographic binding/bundling algorithm is currently registered as an implementation."})

    report = {
        "environment": env, "profile": args.profile, "steps": steps,
        "summary": {
            "passed": sum(s["status"] == "passed" for s in steps),
            "failed": sum(s["status"] == "failed" for s in steps),
            "blocked": sum(s["status"] == "blocked" for s in steps),
            "not_run": sum(s["status"] == "not_run" for s in steps),
            "available_not_executed": sum(s["status"] == "available_not_executed" for s in steps),
        },
        "interpretation": "A successful core run does not certify the full kinetic retrieval architecture. Blocked/not-run integrations require their real adapters, corpus, credentials, and target hardware.",
    }
    report_path = outdir / "report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    (outdir / "commands.txt").write_text(
        "\n".join(" ".join(s.get("command", [])) for s in steps if s.get("command")) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"report": str(report_path), "summary": report["summary"],
                      "commit": env["git_commit"], "steps": [
                          {"name": s["name"], "status": s["status"]} for s in steps]}, indent=2))
    return 1 if report["summary"]["failed"] else (2 if report["summary"]["blocked"] else 0)


if __name__ == "__main__":
    raise SystemExit(main())
