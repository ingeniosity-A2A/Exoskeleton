-- Layer 1b — Core Chassis Long-Term Memory
-- DuckDB Server / DuckLake target schema
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
    tween_id          TEXT PRIMARY KEY,
    molecule_id       TEXT NOT NULL,
    target_property   TEXT NOT NULL,
    start_value       REAL NOT NULL,
    end_value         REAL NOT NULL,
    start_time_ms     INTEGER NOT NULL,
    duration_ms       INTEGER NOT NULL,
    easing_code_id    INTEGER NOT NULL,
    prev_tween_id     TEXT UNIQUE,
    next_tween_id     TEXT UNIQUE,
    FOREIGN KEY (molecule_id) REFERENCES research_molecules(molecule_id)
);

CREATE INDEX IF NOT EXISTS idx_temporal_axis
    ON atomic_tweens(molecule_id, start_time_ms);

CREATE INDEX IF NOT EXISTS idx_tween_property
    ON atomic_tweens(molecule_id, target_property, start_time_ms);

-- Quantized easing / wavefunction codebooks (TurboVecQuant)
CREATE TABLE IF NOT EXISTS turboquant_codebooks (
    codebook_id       INTEGER PRIMARY KEY,
    curve_name        TEXT UNIQUE,
    quantized_levels  BLOB NOT NULL,   -- 16 packed 4-bit amplitude steps
    orthogonal_seed   INTEGER NOT NULL  -- shared basis transformation key
);

-- Optional: generation tracking for async materialization
CREATE TABLE IF NOT EXISTS materialization_generations (
    generation_id     TEXT PRIMARY KEY,
    molecule_id       TEXT NOT NULL,
    created_at        INTEGER DEFAULT (unixepoch()),
    status            TEXT NOT NULL DEFAULT 'pending',
    FOREIGN KEY (molecule_id) REFERENCES research_molecules(molecule_id)
);
