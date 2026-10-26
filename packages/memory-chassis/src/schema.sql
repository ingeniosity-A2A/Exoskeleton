-- Dual-instance chassis schema
-- Ava-007 owns a DuckDB; Exoskeleton owns a DuckDB (Wasm via Rust substrate).
-- The server path is created by the requirements between the two instances.
-- Authority: docs/TWIN_ENGINE_DUCKDB_STATE_FABRIC.md

-- Master temporal container
CREATE TABLE IF NOT EXISTS research_molecules (
    molecule_id       TEXT PRIMARY KEY,
    identity_did      TEXT NOT NULL,
    total_duration_ms INTEGER DEFAULT 0,
    created_at        INTEGER DEFAULT (unixepoch())
);

-- State-transition edge (doubly-linked temporal node)
CREATE TABLE IF NOT EXISTS atomic_tweens (
    tween_id                    TEXT PRIMARY KEY,
    molecule_id                 TEXT NOT NULL,
    target_property             TEXT NOT NULL,
    start_value                 REAL NOT NULL,
    end_value                   REAL NOT NULL,
    start_time_ms               INTEGER NOT NULL,
    duration_ms                 INTEGER NOT NULL,
    easing_code_id              INTEGER NOT NULL,
    orchestrator_generation_id  INTEGER NOT NULL DEFAULT 0,
    prev_tween_id               TEXT UNIQUE,
    next_tween_id               TEXT UNIQUE,
    FOREIGN KEY (molecule_id) REFERENCES research_molecules(molecule_id)
);

CREATE INDEX IF NOT EXISTS idx_temporal_axis
    ON atomic_tweens(molecule_id, start_time_ms);

CREATE INDEX IF NOT EXISTS idx_tween_property
    ON atomic_tweens(molecule_id, target_property, start_time_ms);

CREATE INDEX IF NOT EXISTS idx_tweens_generation
    ON atomic_tweens(orchestrator_generation_id, start_time_ms);

-- Quantized easing / wavefunction codebooks (TurboVecQuant)
CREATE TABLE IF NOT EXISTS turboquant_codebooks (
    codebook_id       INTEGER PRIMARY KEY,
    curve_name        TEXT UNIQUE,
    quantized_levels  BLOB NOT NULL,
    orthogonal_seed   INTEGER NOT NULL
);

-- Generation tracking for async materialization
CREATE TABLE IF NOT EXISTS materialization_generations (
    generation_id     TEXT PRIMARY KEY,
    molecule_id       TEXT NOT NULL,
    created_at        INTEGER DEFAULT (unixepoch()),
    status            TEXT NOT NULL DEFAULT 'pending',
    FOREIGN KEY (molecule_id) REFERENCES research_molecules(molecule_id)
);

-- Skill execution ledger (written by Omnibus actions; owned as chassis tables here)
CREATE TABLE IF NOT EXISTS embedded_skill_execution_ledger (
    transaction_id              TEXT PRIMARY KEY,
    capability_name             TEXT NOT NULL,
    orchestrator_generation_id  INTEGER NOT NULL,
    input_vector_payload        BLOB NOT NULL,
    output_vector_payload       BLOB NOT NULL,
    execution_duration_ms       DOUBLE NOT NULL,
    eval_score                  DOUBLE NOT NULL,
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skill_ledger_capability
    ON embedded_skill_execution_ledger(capability_name, created_at);

CREATE INDEX IF NOT EXISTS idx_skill_ledger_generation
    ON embedded_skill_execution_ledger(orchestrator_generation_id);

-- WAL ring-buffer cursor for A2A consumers
CREATE TABLE IF NOT EXISTS embedded_skill_wal_cursor (
    consumer_id   TEXT PRIMARY KEY,
    last_rowid    BIGINT NOT NULL DEFAULT 0,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
