-- ava-007 schema, DuckDB 2.0.0 LTS "Cinnamon Teal"
-- Migration gate: both engines (Wasm isolate + server) on 2.0 BEFORE first write.
-- Pre-2.0 binaries cannot read 2.0 storage. One-way format.

BEGIN TRANSACTION;

CREATE SEQUENCE IF NOT EXISTS quack_seq START 1;

CREATE TABLE IF NOT EXISTS research_molecules (
  molecule_id        TEXT PRIMARY KEY,
  identity_did       TEXT NOT NULL,
  total_duration_ms  INTEGER DEFAULT 0,
  created_at         INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS atomic_tweens (
  tween_id                   TEXT PRIMARY KEY,
  molecule_id                TEXT NOT NULL,
  target_property            TEXT NOT NULL,
  start_value                DOUBLE NOT NULL,
  end_value                  DOUBLE NOT NULL,
  start_time_ms              BIGINT NOT NULL,
  duration_ms                BIGINT NOT NULL,
  easing_code_id             INTEGER NOT NULL DEFAULT 0,
  orchestrator_generation_id BIGINT NOT NULL DEFAULT 0,
  prev_tween_id              TEXT UNIQUE,
  next_tween_id              TEXT UNIQUE,
  FOREIGN KEY (molecule_id)    REFERENCES research_molecules(molecule_id),
  FOREIGN KEY (prev_tween_id)  REFERENCES atomic_tweens(tween_id),
  FOREIGN KEY (next_tween_id)  REFERENCES atomic_tweens(tween_id)
);

CREATE INDEX IF NOT EXISTS idx_temporal_axis
  ON atomic_tweens(molecule_id, start_time_ms);
CREATE INDEX IF NOT EXISTS idx_tweens_gen_time
  ON atomic_tweens(orchestrator_generation_id, start_time_ms);

CREATE TABLE IF NOT EXISTS turboquant_codebooks (
  codebook_id        INTEGER PRIMARY KEY,
  curve_name         TEXT UNIQUE,
  quantized_levels   BLOB NOT NULL,
  orthogonal_seed    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS turboquant_blocks (
  block_id    BIGINT PRIMARY KEY,
  molecule_id TEXT,
  dim         USMALLINT NOT NULL,
  bit_width   UTINYINT  NOT NULL CHECK (bit_width BETWEEN 2 AND 4),
  codes       BLOB      NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_registry (
  capability    TEXT PRIMARY KEY,
  schema_def    VARIANT NOT NULL,
  version       TEXT DEFAULT '0.0.0',
  description   TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS embedded_skill_execution_ledger (
  transaction_id             TEXT PRIMARY KEY,
  capability_name            TEXT NOT NULL,
  orchestrator_generation_id INTEGER NOT NULL,
  input_vector_payload       BLOB NOT NULL,
  output_vector_payload      BLOB NOT NULL,
  execution_duration_ms      DOUBLE NOT NULL,
  eval_score                 DOUBLE NOT NULL CHECK (eval_score BETWEEN 0 AND 1),
  created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_skill_execution_metrics
  ON embedded_skill_execution_ledger(capability_name, eval_score DESC);

CREATE TABLE IF NOT EXISTS quack_outbox (
  seq             BIGINT PRIMARY KEY,
  molecule_id     TEXT NOT NULL,
  target_property TEXT NOT NULL,
  op              TEXT NOT NULL CHECK (op IN ('insert','truncate','purge')),
  start_time_ms   BIGINT,
  duration_ms     BIGINT,
  start_value     DOUBLE,
  end_value       DOUBLE,
  easing_code_id  INTEGER,
  generation      BIGINT NOT NULL,
  committed_at    BIGINT NOT NULL DEFAULT (CAST(epoch_ms(now()) AS BIGINT))
);
CREATE INDEX IF NOT EXISTS idx_outbox_unsynced ON quack_outbox(seq);

CREATE TABLE IF NOT EXISTS quack_apply_watermark (
  source_id   TEXT PRIMARY KEY,
  applied_seq BIGINT NOT NULL DEFAULT 0,
  applied_at  BIGINT
);

CREATE TABLE IF NOT EXISTS quack_outbox_ack (
  id        UTINYINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  acked_seq BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS embedded_skill_wal_cursor (
  consumer_id   TEXT PRIMARY KEY,
  last_rowid    BIGINT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Law of Overwrite as schema law: every atomic_tweens mutation replicates to outbox.

CREATE TRIGGER tg_outbox_insert AFTER INSERT ON atomic_tweens
BEGIN
  INSERT INTO quack_outbox
    (seq, molecule_id, target_property, op,
     start_time_ms, duration_ms, start_value, end_value,
     easing_code_id, generation)
  VALUES
    (nextval('quack_seq'), NEW.molecule_id, NEW.target_property, 'insert',
     NEW.start_time_ms, NEW.duration_ms, NEW.start_value, NEW.end_value,
     NEW.easing_code_id,
     COALESCE(TRY_CAST(current_setting('ava.generation') AS BIGINT), 0));
END;

CREATE TRIGGER tg_outbox_truncate AFTER UPDATE ON atomic_tweens
BEGIN
  INSERT INTO quack_outbox
    (seq, molecule_id, target_property, op,
     start_time_ms, duration_ms, start_value, end_value,
     easing_code_id, generation)
  VALUES
    (nextval('quack_seq'), NEW.molecule_id, NEW.target_property, 'truncate',
     NEW.start_time_ms, NEW.duration_ms, NEW.start_value, NEW.end_value,
     NEW.easing_code_id,
     COALESCE(TRY_CAST(current_setting('ava.generation') AS BIGINT), 0));
END;

CREATE TRIGGER tg_outbox_purge AFTER DELETE ON atomic_tweens
BEGIN
  INSERT INTO quack_outbox
    (seq, molecule_id, target_property, op,
     start_time_ms, duration_ms, start_value, end_value,
     easing_code_id, generation)
  VALUES
    (nextval('quack_seq'), OLD.molecule_id, OLD.target_property, 'purge',
     OLD.start_time_ms, OLD.duration_ms, OLD.start_value, OLD.end_value,
     OLD.easing_code_id,
     COALESCE(TRY_CAST(current_setting('ava.generation') AS BIGINT), 0));
END;

COMMIT;
