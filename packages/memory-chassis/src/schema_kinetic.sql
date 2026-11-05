-- Additive Kinetic Intelligence schema. Apply only after schema_20.sql.
-- Durable Source Truth stays in DuckDB; retrieval indexes remain rebuildable projections.

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS source_artifacts (
  source_id       TEXT PRIMARY KEY,
  source_kind     TEXT NOT NULL CHECK (source_kind IN ('huggingface_model','huggingface_dataset','paper','document','observation','other')),
  repository_id   TEXT,
  revision        TEXT,
  source_uri      TEXT,
  relative_path   TEXT,
  sha256          TEXT NOT NULL,
  license_id      TEXT,
  acquired_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata        VARIANT
);

CREATE TABLE IF NOT EXISTS document_regions (
  region_id          TEXT PRIMARY KEY,
  source_id          TEXT NOT NULL,
  page_no            INTEGER,
  reading_order      INTEGER,
  region_kind        TEXT NOT NULL CHECK (region_kind IN ('title','heading','paragraph','list','table','table_cell','figure','caption','formula','code','other')),
  bbox               VARIANT,
  text_content       TEXT,
  structure_payload  VARIANT,
  extraction_engine  TEXT NOT NULL,
  extraction_version TEXT NOT NULL,
  confidence         DOUBLE CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  FOREIGN KEY (source_id) REFERENCES source_artifacts(source_id)
);
CREATE INDEX IF NOT EXISTS idx_document_regions_source_page
  ON document_regions(source_id, page_no, reading_order);

CREATE TABLE IF NOT EXISTS memory_atoms (
  atom_id            TEXT PRIMARY KEY,
  source_id          TEXT NOT NULL,
  region_id          TEXT,
  parent_atom_id     TEXT,
  content            TEXT NOT NULL,
  content_type       TEXT NOT NULL CHECK (content_type IN ('text','entity','relation','event','value','table_cell','formula','figure_caption','observation','summary','other')),
  subject            TEXT,
  predicate          TEXT,
  object_value       TEXT,
  page_no            INTEGER,
  bbox               VARIANT,
  table_id           TEXT,
  row_index          INTEGER,
  column_index       INTEGER,
  valid_from         TIMESTAMP,
  valid_to           TIMESTAMP,
  recorded_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source_confidence  DOUBLE CHECK (source_confidence IS NULL OR source_confidence BETWEEN 0 AND 1),
  extraction_method  TEXT NOT NULL,
  tenant_id          TEXT NOT NULL DEFAULT 'default',
  role_tags          VARIANT,
  policy_tags        VARIANT,
  content_hash       TEXT NOT NULL,
  acceptance_state  TEXT NOT NULL DEFAULT 'pending'
    CHECK (acceptance_state IN ('pending','accepted','rejected','superseded')),
  accepted_by        TEXT,
  accepted_at        TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES source_artifacts(source_id),
  FOREIGN KEY (region_id) REFERENCES document_regions(region_id),
  FOREIGN KEY (parent_atom_id) REFERENCES memory_atoms(atom_id),
  CHECK (
    acceptance_state <> 'accepted'
    OR (accepted_by IS NOT NULL AND accepted_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_memory_atoms_source
  ON memory_atoms(source_id, page_no);
CREATE INDEX IF NOT EXISTS idx_memory_atoms_policy
  ON memory_atoms(tenant_id, acceptance_state, content_type);
CREATE INDEX IF NOT EXISTS idx_memory_atoms_temporal
  ON memory_atoms(valid_from, valid_to, recorded_at);

CREATE TABLE IF NOT EXISTS atom_derivations (
  child_atom_id   TEXT NOT NULL,
  parent_atom_id  TEXT NOT NULL,
  derivation_kind TEXT NOT NULL,
  model_id        TEXT,
  model_revision  TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (child_atom_id, parent_atom_id, derivation_kind),
  FOREIGN KEY (child_atom_id) REFERENCES memory_atoms(atom_id),
  FOREIGN KEY (parent_atom_id) REFERENCES memory_atoms(atom_id)
);

-- TurboVec IdMapIndex uses stable uint64 ids. This table maps them to canonical
-- atom identities; the .tvim file itself is a rebuildable derived artifact.
CREATE TABLE IF NOT EXISTS vector_projection_registry (
  vector_id       UBIGINT PRIMARY KEY,
  atom_id         TEXT NOT NULL UNIQUE,
  model_id        TEXT NOT NULL,
  model_revision  TEXT NOT NULL,
  dimension       USMALLINT NOT NULL,
  bit_width       UTINYINT NOT NULL CHECK (bit_width BETWEEN 2 AND 4),
  index_artifact  TEXT NOT NULL,
  artifact_sha256 TEXT NOT NULL,
  projection_gen  UBIGINT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (atom_id) REFERENCES memory_atoms(atom_id)
);

CREATE TABLE IF NOT EXISTS kinetic_eval_runs (
  run_id            TEXT PRIMARY KEY,
  source_manifest_sha256 TEXT NOT NULL,
  query_set_sha256  TEXT NOT NULL,
  code_commit       TEXT NOT NULL,
  model_manifest    VARIANT NOT NULL,
  hardware_manifest VARIANT NOT NULL,
  transport_manifest VARIANT,
  started_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at      TIMESTAMP,
  status            TEXT NOT NULL CHECK (status IN ('running','completed','failed','blocked'))
);

CREATE TABLE IF NOT EXISTS kinetic_eval_results (
  run_id             TEXT NOT NULL,
  experiment_arm    TEXT NOT NULL,
  metric_name       TEXT NOT NULL,
  metric_value      DOUBLE NOT NULL,
  unit              TEXT NOT NULL,
  sample_count      UBIGINT,
  p50               DOUBLE,
  p95               DOUBLE,
  p99               DOUBLE,
  raw_artifact_path TEXT,
  PRIMARY KEY (run_id, experiment_arm, metric_name),
  FOREIGN KEY (run_id) REFERENCES kinetic_eval_runs(run_id)
);

COMMIT;
