import tempfile
import unittest
from pathlib import Path

from memory import MemoryStore


class MemoryStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "memory.duckdb"
        self.store = MemoryStore(self.db_path)

    def tearDown(self):
        self.store.close()
        self.temp_dir.cleanup()

    def test_write_survives_reopen_and_preserves_provenance(self):
        record_id = self.store.remember(
            "The user prefers DuckDB", owner="alice", source="conversation",
            scope="private", metadata={"turn": 7}, observed_at=123.5)
        first = self.store.get(record_id, principal="alice")
        self.assertIsNotNone(first)
        self.assertEqual(first.source, "conversation")
        self.assertEqual(first.observed_at, 123.5)
        self.assertEqual(first.metadata, {"turn": 7})
        self.assertEqual(len(first.content_hash), 64)
        self.store.close()
        self.store = MemoryStore(self.db_path)
        reopened = self.store.get(record_id, principal="alice")
        self.assertEqual(reopened, first)
        self.assertTrue(self.store.verify_chain())

    def test_owner_and_explicit_scope_authorization(self):
        private_id = self.store.remember(
            "private project detail", owner="alice", source="note")
        shared_id = self.store.remember(
            "team deployment decision", owner="alice", source="meeting", scope="team")
        self.assertIsNone(self.store.get(private_id, principal="bob", allowed_scopes={"team"}))
        self.assertIsNone(self.store.get(shared_id, principal="bob"))
        self.assertEqual(
            self.store.get(shared_id, principal="bob", allowed_scopes={"team"}).id,
            shared_id)
        self.assertEqual(self.store.get(private_id, principal="alice").id, private_id)

    def test_search_filters_before_returning_evidence(self):
        self.store.remember("shared launch plan", owner="alice", source="note", scope="team")
        self.store.remember("private launch plan", owner="alice", source="note")
        self.assertEqual(
            [r.content for r in self.store.search("launch plan", principal="bob")], [])
        self.assertEqual(
            [r.content for r in self.store.search(
                "launch plan", principal="bob", allowed_scopes={"team"})],
            ["shared launch plan"])

    def test_empty_content_rejected_without_corrupting_store(self):
        with self.assertRaises(ValueError):
            self.store.remember("  ", owner="alice", source="test")
        self.assertTrue(self.store.verify_chain())


if __name__ == "__main__":
    unittest.main()
