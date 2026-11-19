"""DuckDB-backed memory with transactional writes and inspectable provenance.

Retrieval is deterministic lexical matching. This module does not claim to
provide embeddings, learned ranking, or semantic inference.
"""

from __future__ import annotations

import hashlib
import json
import math
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import duckdb


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _sql_literal(value: str | int | float) -> str:
    """Encode the scalar types written by this module as SQL literals."""
    if isinstance(value, str):
        return "'" + value.replace("'", "''") + "'"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float) and math.isfinite(value):
        return repr(value)
    raise ValueError("unsupported or non-finite SQL value")


@dataclass(frozen=True)
class MemoryRecord:
    id: str
    observed_at: float
    source: str
    owner: str
    scope: str
    content: str
    metadata: dict[str, Any]
    content_hash: str
    previous_hash: str
    record_hash: str


class MemoryStore:
    """Append-only DuckDB memory with owner and explicit-scope authorization.

    Owners can read their own records. Other principals can read a record only
    when its non-private scope is in ``allowed_scopes``. Authorization is
    enforced inside the store on every read and search.
    """

    def __init__(
        self,
        path: str | Path = "./data/memory.duckdb",
        *,
        quack_uri: str | None = None,
    ) -> None:
        """Open local storage or attach to a DuckDB 2.x Quack server.

        Use ``quack_uri="quack:localhost:9494"`` for the shared server. The
        DuckDB client must have the Quack extension available and its Quack
        secret store must contain credentials for that endpoint.
        """
        self.path = str(path)
        self._remote = quack_uri is not None
        if self._remote:
            self._db = duckdb.connect(":memory:")
            self._db.execute("LOAD quack")
            escaped_uri = quack_uri.replace("'", "''")
            self._db.execute(
                f"ATTACH '{escaped_uri}' AS exoskeleton_memory (TYPE quack)"
            )
            self._db.execute("CONNECT exoskeleton_memory")
        else:
            if self.path != ":memory:":
                Path(self.path).parent.mkdir(parents=True, exist_ok=True)
            self._db = duckdb.connect(self.path)
        self._db.execute("CREATE SEQUENCE IF NOT EXISTS memory_order START 1")
        self._db.execute("""CREATE TABLE IF NOT EXISTS memories (
            insertion_order BIGINT PRIMARY KEY,
            id VARCHAR UNIQUE NOT NULL,
            observed_at DOUBLE NOT NULL,
            source VARCHAR NOT NULL,
            owner VARCHAR NOT NULL,
            scope VARCHAR NOT NULL,
            content VARCHAR NOT NULL,
            metadata_json VARCHAR NOT NULL,
            content_hash VARCHAR NOT NULL,
            previous_hash VARCHAR NOT NULL,
            record_hash VARCHAR UNIQUE NOT NULL
        )""")
        self._db.execute("CREATE INDEX IF NOT EXISTS memories_owner ON memories(owner)")
        self._db.execute("CREATE INDEX IF NOT EXISTS memories_scope ON memories(scope)")

    def close(self) -> None:
        if self._remote:
            self._db.execute("DISCONNECT")
        self._db.close()

    def __enter__(self) -> "MemoryStore":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def remember(
        self,
        content: str,
        *,
        owner: str,
        source: str,
        scope: str = "private",
        metadata: dict[str, Any] | None = None,
        observed_at: float | None = None,
    ) -> str:
        if not isinstance(content, str) or not content.strip():
            raise ValueError("content must be a non-empty string")
        if not all(isinstance(value, str) and value.strip() for value in (owner, source, scope)):
            raise ValueError("owner, source, and scope must be non-empty strings")
        metadata = {} if metadata is None else metadata
        if not isinstance(metadata, dict):
            raise TypeError("metadata must be a dictionary")

        when = time.time() if observed_at is None else float(observed_at)
        if not math.isfinite(when):
            raise ValueError("observed_at must be finite")
        record_id = str(uuid.uuid4())
        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        metadata_json = _canonical(metadata)
        self._db.execute("BEGIN TRANSACTION")
        try:
            latest = self._db.execute(
                "SELECT record_hash FROM memories ORDER BY insertion_order DESC LIMIT 1"
            ).fetchone()
            previous = latest[0] if latest else "0" * 64
            body = {
                "id": record_id, "observed_at": when, "source": source,
                "owner": owner, "scope": scope, "content_hash": content_hash,
                "metadata": metadata, "previous_hash": previous,
            }
            record_hash = hashlib.sha256(_canonical(body).encode("utf-8")).hexdigest()
            insertion_order = self._db.execute("SELECT nextval('memory_order')").fetchone()[0]
            values = [insertion_order, record_id, when, source, owner, scope,
                      content, metadata_json, content_hash, previous, record_hash]
            if self._remote:
                sql_values = ", ".join(_sql_literal(value) for value in values)
                self._db.execute(f"INSERT INTO memories VALUES ({sql_values})")
            else:
                self._db.execute("""INSERT INTO memories VALUES
                    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", values)
            self._db.execute("COMMIT")
        except Exception:
            self._db.execute("ROLLBACK")
            raise
        return record_id

    @staticmethod
    def _record(row: tuple[Any, ...]) -> MemoryRecord:
        (_, record_id, observed_at, source, owner, scope, content, metadata_json,
         content_hash, previous_hash, record_hash) = row
        return MemoryRecord(
            id=record_id, observed_at=observed_at, source=source, owner=owner,
            scope=scope, content=content, metadata=json.loads(metadata_json),
            content_hash=content_hash, previous_hash=previous_hash,
            record_hash=record_hash)

    @staticmethod
    def _authorized(row: tuple[Any, ...], principal: str, scopes: set[str]) -> bool:
        owner, scope = row[4], row[5]
        return owner == principal or (scope != "private" and scope in scopes)

    def get(
        self, record_id: str, *, principal: str,
        allowed_scopes: Iterable[str] = (),
    ) -> MemoryRecord | None:
        if self._remote:
            row = self._db.execute(
                f"SELECT * FROM memories WHERE id = {_sql_literal(record_id)}"
            ).fetchone()
        else:
            row = self._db.execute(
                "SELECT * FROM memories WHERE id = ?", [record_id]
            ).fetchone()
        if row is None or not self._authorized(row, principal, set(allowed_scopes)):
            return None
        return self._record(row)

    def search(
        self, query: str, *, principal: str,
        allowed_scopes: Iterable[str] = (), limit: int = 10,
    ) -> list[MemoryRecord]:
        """Return authorized records containing all query terms, newest first."""
        terms = [term.casefold() for term in query.split() if term]
        if not terms or limit <= 0:
            return []
        scopes = set(allowed_scopes)
        rows = self._db.execute(
            "SELECT * FROM memories ORDER BY insertion_order DESC"
        ).fetchall()
        results = []
        for row in rows:
            if self._authorized(row, principal, scopes) and all(
                term in row[6].casefold() for term in terms
            ):
                results.append(self._record(row))
                if len(results) >= limit:
                    break
        return results

    def verify_chain(self) -> bool:
        """Verify every content digest and provenance link in insertion order."""
        previous = "0" * 64
        rows = self._db.execute(
            "SELECT * FROM memories ORDER BY insertion_order"
        ).fetchall()
        for row in rows:
            (_, record_id, observed_at, source, owner, scope, content,
             metadata_json, content_hash, previous_hash, record_hash) = row
            if hashlib.sha256(content.encode("utf-8")).hexdigest() != content_hash:
                return False
            if previous_hash != previous:
                return False
            body = {
                "id": record_id, "observed_at": observed_at, "source": source,
                "owner": owner, "scope": scope, "content_hash": content_hash,
                "metadata": json.loads(metadata_json), "previous_hash": previous,
            }
            calculated = hashlib.sha256(_canonical(body).encode("utf-8")).hexdigest()
            if calculated != record_hash:
                return False
            previous = record_hash
        return True
