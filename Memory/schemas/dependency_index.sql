-- ============================================================================
-- Exoskeleton/Memory/schemas/dependency_index.sql
-- ============================================================================
-- DEPENDENCY INDEX — lives in DuckDB 2.0 (Long-Term Lake)
--
-- "Dependency > Version > Dependency GitHub Link > Host WebSocket or
--  preferred network communication > MCP, API, CLI collapses into both"
--
-- "Whichever one has direct documentation knowledge is the lead bot"
--
-- "DEPENDENCY INDEX LIVES IN DUCKDB 2.0"
--
-- This is the SOURCE OF TRUTH. INDEX.md is a RENDER of this table.
-- ============================================================================

-- ============================================================================
-- TABLE: dependencies
-- The canonical dependency registry.
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_dependency START 1;

CREATE TABLE IF NOT EXISTS dependencies (
    id              BIGINT PRIMARY KEY DEFAULT nextval('seq_dependency'),

    -- ── Column 1: Dependency name ──────────────────────────────────────────
    name            VARCHAR NOT NULL UNIQUE,
    -- Short identifier (e.g., "kiri", "tailscale", "duckdb", "stanza")

    -- ── Column 2: Version ─────────────────────────────────────────────────
    version         VARCHAR NOT NULL,
    -- Semver or pinned version (e.g., "0.1.0", "1.14.2", "2.0.0")

    -- ── Column 3: Dependency GitHub Link ──────────────────────────────────
    github_url      VARCHAR NOT NULL,
    -- Canonical repository URL (e.g., "https://github.com/libracoder/kiri")

    -- ── Column 4: Host WebSocket or preferred network communication ───────
    comm_protocol   VARCHAR NOT NULL DEFAULT 'websocket',
    -- One of: 'websocket', 'grpc', 'http', 'ssh', 'vsock', 'unix-socket',
    --         'mqtt', 'quic', 'tailnet'
    comm_endpoint   VARCHAR,
    -- The actual endpoint or connection string pattern

    -- ── Column 5: Interface collapse (MCP, API, CLI → both) ───────────────
    -- "MCP, API, CLI collapses into both"
    -- Each dependency exposes ONE OR MORE interfaces. The collapsed bot
    -- presents them as unified surfaces.
    exposes_mcp     BOOLEAN NOT NULL DEFAULT FALSE,
    exposes_api     BOOLEAN NOT NULL DEFAULT FALSE,
    exposes_cli     BOOLEAN NOT NULL DEFAULT FALSE,

    -- ── Lead bot arbitration ──────────────────────────────────────────────
    -- "Whichever one has direct documentation knowledge is the lead bot"
    has_direct_docs BOOLEAN NOT NULL DEFAULT FALSE,
    -- TRUE if this dependency has direct documentation knowledge for the
    -- current host (i.e., it can answer "how do I use X on this host?")
    lead_interface  VARCHAR,
    -- Which interface is the LEAD for this dependency on this host:
    -- 'mcp', 'api', 'cli', or 'both' (collapsed)
    -- Determined at runtime by lead_selector.py based on documentation
    -- knowledge availability.

    -- ── Host-aware routing ────────────────────────────────────────────────
    host_profile    VARCHAR NOT NULL DEFAULT 'any',
    -- 's26_ultra_termux', 'linux_vps', 'gpu_compute_node', 'any'

    -- ── Epistemic provenance (Discipline 3) ───────────────────────────────
    epistemic_state VARCHAR NOT NULL DEFAULT 'OBSERVED',
    -- OBSERVED: version and link verified from live source
    -- DERIVED:  computed from lockfile or manifest
    -- INFERRED: guessed from context (BLOCKED from Green Band)
    -- HYPOTHESIZED: proposed but unverified
    verified_at     TIMESTAMP,
    verification_method VARCHAR,
    -- 'gh_api', 'lockfile', 'manual', 'reputation_council'

    -- ── Audit ─────────────────────────────────────────────────────────────
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    content_hash    VARCHAR NOT NULL
    -- BLAKE3 hash of (name, version, github_url) for audit trail
);

-- ============================================================================
-- TABLE: dependency_versions
-- Full version history (for drift detection).
-- ============================================================================
CREATE TABLE IF NOT EXISTS dependency_versions (
    id              BIGINT PRIMARY KEY DEFAULT nextval('seq_dependency'),
    dependency_id   BIGINT NOT NULL REFERENCES dependencies(id),
    version         VARCHAR NOT NULL,
    released_at     TIMESTAMP,
    is_current      BOOLEAN NOT NULL DEFAULT FALSE,
    changelog_url   VARCHAR,
    discovered_via  VARCHAR NOT NULL DEFAULT 'gh_api',
    discovered_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE: host_interfaces
-- Tracks which interface (MCP/API/CLI) is the lead per host.
-- ============================================================================
CREATE TABLE IF NOT EXISTS host_interfaces (
    id              BIGINT PRIMARY KEY DEFAULT nextval('seq_dependency'),
    host_profile    VARCHAR NOT NULL,
    dependency_id   BIGINT NOT NULL REFERENCES dependencies(id),
    interface       VARCHAR NOT NULL,
    -- 'mcp', 'api', 'cli'

    -- "Whichever one has direct documentation knowledge is the lead bot"
    has_documentation BOOLEAN NOT NULL DEFAULT FALSE,
    is_lead         BOOLEAN NOT NULL DEFAULT FALSE,

    -- Documentation sources
    docs_url        VARCHAR,
    docs_completeness FLOAT DEFAULT 0.0,
    -- 0.0 = no docs, 1.0 = complete docs

    -- Host-specific routing
    comm_protocol   VARCHAR NOT NULL,
    comm_endpoint   VARCHAR,

    UNIQUE(host_profile, dependency_id, interface)
);

-- ============================================================================
-- TABLE: dep_audit_ledger
-- Cryptographically chained audit trail (Discipline 5).
-- ============================================================================
CREATE TABLE IF NOT EXISTS dep_audit_ledger (
    event_id        BIGINT PRIMARY KEY,
    dependency_id   BIGINT,
    action          VARCHAR NOT NULL,
    -- 'added', 'version_bumped', 'verified', 'demoted', 'promoted', 'removed'
    details         VARCHAR,
    prev_hash       VARCHAR NOT NULL,
    event_hash      VARCHAR NOT NULL,
    event_time      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- The INDEX.md render source: active dependencies with lead interface
CREATE OR REPLACE VIEW v_dependency_index AS
SELECT
    d.name                          AS "Dependency",
    d.version                       AS "Version",
    d.github_url                    AS "Dependency GitHub Link",
    d.comm_protocol || COALESCE(
        ' (' || d.comm_endpoint || ')', ''
    )                               AS "Host Communication",
    -- "MCP, API, CLI collapses into both"
    CASE
        WHEN d.exposes_mcp AND d.exposes_api AND d.exposes_cli THEN 'MCP + API + CLI (collapsed)'
        WHEN d.exposes_mcp AND d.exposes_api                  THEN 'MCP + API (collapsed)'
        WHEN d.exposes_mcp AND d.exposes_cli                  THEN 'MCP + CLI (collapsed)'
        WHEN d.exposes_api AND d.exposes_cli                  THEN 'API + CLI (collapsed)'
        WHEN d.exposes_mcp                                     THEN 'MCP'
        WHEN d.exposes_api                                     THEN 'API'
        WHEN d.exposes_cli                                     THEN 'CLI'
        ELSE 'none'
    END                             AS "Interface",
    d.lead_interface                AS "Lead Bot",
    d.epistemic_state               AS "Epistemic State",
    d.verified_at                   AS "Verified At",
    d.host_profile                  AS "Host Profile"
FROM dependencies d
WHERE d.epistemic_state IN ('OBSERVED', 'DERIVED')
ORDER BY d.name;

-- Dependencies with documentation (lead bot candidates)
CREATE OR REPLACE VIEW v_lead_candidates AS
SELECT
    d.name,
    d.version,
    hi.host_profile,
    hi.interface,
    hi.has_documentation,
    hi.docs_completeness,
    hi.is_lead
FROM dependencies d
JOIN host_interfaces hi ON hi.dependency_id = d.id
WHERE hi.has_documentation = TRUE
ORDER BY hi.docs_completeness DESC;

-- Epistemic gate: unverified dependencies (Orange Band)
CREATE OR REPLACE VIEW v_orange_band AS
SELECT * FROM dependencies
WHERE epistemic_state IN ('INFERRED', 'HYPOTHESIZED');

-- Green Band: verified dependencies
CREATE OR REPLACE VIEW v_green_band AS
SELECT * FROM dependencies
WHERE epistemic_state IN ('OBSERVED', 'DERIVED');
