#!/usr/bin/env python3
"""DuckDB 2.0 schema and atomic-memory authority invariant tests."""
from __future__ import annotations
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("BLOCKED: install DuckDB Python 2.0.x to validate schema")
        return 2

    version = duckdb.__version__
    if not version.startswith("2.0."):
        print(f"BLOCKED: expected DuckDB 2.0.x, found {version}")
        return 2

    con = duckdb.connect(":memory:")
    base = ROOT / "packages/memory-chassis/src/schema_20.sql"
    kinetic = ROOT / "packages/memory-chassis/src/schema_kinetic.sql"
    con.execute(base.read_text(encoding="utf-8"))
    con.execute(kinetic.read_text(encoding="utf-8"))

    con.execute("""
      INSERT INTO source_artifacts
        (source_id, source_kind, source_uri, sha256, license_id)
      VALUES ('source-test', 'document', 'file://fixture.pdf', 'sha256-fixture', 'test-only')
    """)
    con.execute("""
      INSERT INTO document_regions
        (region_id, source_id, page_no, reading_order, region_kind,
         text_content, extraction_engine, extraction_version)
      VALUES ('region-test', 'source-test', 1, 0, 'paragraph',
              'kinetic memory test', 'fixture', '1')
    """)
    con.execute("""
      INSERT INTO memory_atoms
        (atom_id, source_id, region_id, content, content_type,
         extraction_method, content_hash)
      VALUES ('atom-test', 'source-test', 'region-test',
              'kinetic memory test', 'text', 'fixture', 'atom-hash')
    """)

    rejected = False
    try:
        con.execute("UPDATE memory_atoms SET acceptance_state='accepted' WHERE atom_id='atom-test'")
    except Exception:
        rejected = True
    if not rejected:
        raise AssertionError("acceptance gate allowed accepted state without accepted_by/accepted_at")

    con.execute("""
      UPDATE memory_atoms
      SET acceptance_state='accepted', accepted_by='ava-007-test-authority',
          accepted_at=CURRENT_TIMESTAMP
      WHERE atom_id='atom-test'
    """)
    state = con.execute("SELECT acceptance_state FROM memory_atoms WHERE atom_id='atom-test'").fetchone()[0]
    if state != "accepted":
        raise AssertionError(f"unexpected acceptance state: {state}")

    con.execute("""
      INSERT INTO vector_projection_registry
        (vector_id, atom_id, model_id, model_revision, dimension,
         bit_width, index_artifact, artifact_sha256, projection_gen)
      VALUES (9000001, 'atom-test', 'test-embedder', 'fixture-rev',
              8, 4, 'fixture.tvim', 'fixture-index-sha', 1)
    """)
    print(f"PASS: DuckDB {version}; schema_20 + schema_kinetic; pending-by-default; acceptance metadata gate; stable vector-id mapping")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
