# Exoskeleton

Successor to `a2a-exoskeleton` (archived reference).

## Memory

Exoskeleton provides a local DuckDB-backed memory store in `memory/`. It
persists observations transactionally, records source/owner/scope and hashes,
supports authorized exact-term retrieval, and can verify the provenance chain.
It is a lexical retrieval baseline; it does not provide embeddings or learned
ranking.

Install the Python dependency and initialize a database:

```sh
python -m pip install -r requirements.txt
python -c 'from memory import MemoryStore; MemoryStore("./data/memory.duckdb").close()'
```

See [the memory contract](docs/MEMORY.md) for integration and authorization
rules. Tests are run with `python -m unittest discover -s tests`.

Only claims backed by recorded command output (see `docs/VALIDATION.md`) are
reported as verified. Unrun builds, tests, and benchmarks remain unverified.
