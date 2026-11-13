# Exoskeleton memory contract

## Responsibilities

`memory.MemoryStore` is the durable local observation store. It uses DuckDB
2.x and stores each record's content, observation time, source, owner, scope,
metadata, content digest, previous-record digest, and record digest in one
transaction. The append-only hash chain is tamper-evident; it is not a
cryptographic signature and does not authenticate the writer.

The store is the source of truth for observations written through this API.
Retrieval is exact-term lexical matching over authorized records. No vector
index, semantic ranking, or model inference is currently implemented.

## Authorization boundary

- Every write supplies an `owner`, `source`, and `scope`.
- The owner may retrieve their own records.
- A different principal may retrieve a record only when its non-private scope
  is included in that call's `allowed_scopes`.
- `private` records are never made readable to another principal by including
  `private` in `allowed_scopes`.
- Retrieval returns `MemoryRecord` evidence, including provenance and hashes;
  callers should preserve that evidence when using a result.

The current API accepts an authenticated principal and allowed scopes from its
caller. An application must derive those values from its own trusted identity
and authorization layer. They must not be accepted directly from untrusted
user input. DuckDB file access is also a local trust boundary: users with direct
database-file access can bypass application-level authorization.

## Minimal integration

```python
from memory import MemoryStore

with MemoryStore("./data/memory.duckdb") as memory:
    record_id = memory.remember(
        "Deployment uses region east-1",
        owner="did:example:agent",
        source="deployment-observation",
        scope="team:platform",
        metadata={"request_id": "req-123"},
    )
    evidence = memory.search(
        "deployment region",
        principal="did:example:agent",
        allowed_scopes={"team:platform"},
    )
    assert memory.get(record_id, principal="did:example:agent") is not None
    assert memory.verify_chain()
```

`remember` returns a stable record ID. `get` and `search` return no unauthorized
record (the unauthorized `get` result is `None`). The caller remains responsible
for policy decisions such as retention, deletion, promotion, and whether a
retrieved observation is relevant to a response. Do not insert secrets or raw
personal data unless the application has an explicit policy for them.

## Operational limits

This first implementation targets a single local database file and a single
process owning the writer connection. For multiple processes, serve access
through one process rather than opening concurrent writers. Backups should be
made from a closed/checkpointed database. The hash chain detects accidental or
unauthorized content modification when verified, but an attacker able to
rewrite the full file can recompute it; signed checkpoints are future work.
