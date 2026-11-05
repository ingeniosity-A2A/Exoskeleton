-- TweenAtom persistence contract; apply after schema_20.sql and schema_kinetic.sql.
-- This table records receipt references; signature verification belongs to the
-- authorized AVA-007 boundary and is not performed by this schema.

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS atomic_tweens (
  tween_atom_id UUID PRIMARY KEY,
  stream_id UUID NOT NULL,
  schema_version USMALLINT NOT NULL,
  generation UBIGINT NOT NULL CHECK (generation > 0),
  predecessor_id UUID,
  successor_id UUID,
  capability_id TEXT NOT NULL,
  intent_kind TEXT NOT NULL,
  compact_intent TEXT,
  tokenizer_id TEXT,
  token_count USMALLINT,
  transition_law_id TEXT NOT NULL,
  easing_id TEXT NOT NULL,
  start_unix_micros BIGINT NOT NULL,
  end_unix_micros BIGINT NOT NULL,
  payload_uri TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL CHECK (length(payload_sha256) = 64),
  payload_media_type TEXT NOT NULL,
  source_refs VARIANT NOT NULL,
  policy_version TEXT NOT NULL,
  authority_state TEXT NOT NULL CHECK (authority_state IN ('pending','accepted','rejected')),
  authority_receipt_ref TEXT,
  execution_state TEXT NOT NULL CHECK (execution_state IN ('not_started','running','succeeded','failed','compensated')),
  execution_receipt_ref TEXT,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_unix_micros >= start_unix_micros),
  UNIQUE (stream_id, generation),
  CHECK (
    (compact_intent IS NULL AND tokenizer_id IS NULL AND token_count IS NULL)
    OR (compact_intent IS NOT NULL AND tokenizer_id IS NOT NULL AND token_count = 53)
  ),
  CHECK (authority_state = 'pending' OR (authority_receipt_ref IS NOT NULL AND length(authority_receipt_ref) > 0)),
  CHECK (execution_state = 'not_started' OR authority_state = 'accepted'),
  CHECK (execution_state <> 'succeeded' OR (execution_receipt_ref IS NOT NULL AND length(execution_receipt_ref) > 0))
);

CREATE INDEX IF NOT EXISTS idx_atomic_tweens_stream_generation ON atomic_tweens(stream_id, generation);
CREATE INDEX IF NOT EXISTS idx_atomic_tweens_authority_execution ON atomic_tweens(authority_state, execution_state);
CREATE INDEX IF NOT EXISTS idx_atomic_tweens_temporal ON atomic_tweens(start_unix_micros, end_unix_micros);

COMMIT;
