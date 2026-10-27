import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

export interface ArenaView {
  data: number;
  itemBytes: number;
  count: number;
  dim?: number;
  bitWidth?: number;
}

declare function ava_codes_view(arena: number): ArenaView;

export interface MailboxSnapshot {
  /** Generation watermark from Layer 0 seqlock */
  generation: number;
  dim: number;
  bitWidth: number;
  /** Raw packed codes (header already stripped by Rust snapshot_for_ingest) */
  codes: Uint8Array;
}

/**
 * Layer 0 → DuckDB: one materialization copy of a generation-consistent
 * mailbox snapshot into turboquant_blocks.
 */
export async function ingestMailboxSnapshot(
  conn: AsyncDuckDBConnection,
  snapshot: MailboxSnapshot,
  moleculeId: string | null,
  blockId: number,
): Promise<void> {
  if (snapshot.bitWidth < 2 || snapshot.bitWidth > 4) {
    throw new Error(`bitWidth out of range: ${snapshot.bitWidth}`);
  }
  const hex = Array.from(snapshot.codes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const mol = moleculeId ? `'${moleculeId.replace(/'/g, "''")}'` : 'NULL';
  await conn.query(
    `INSERT INTO turboquant_blocks (block_id, molecule_id, dim, bit_width, codes)
     VALUES (${blockId}, ${mol}, ${snapshot.dim}, ${snapshot.bitWidth}, X'${hex}')`,
  );
}

/**
 * Arena FFI path (Wasm linear memory). Prefer ingestMailboxSnapshot when
 * data already passed through Layer 0 seqlock validation.
 */
export async function ingestArenaBlocks(
  conn: AsyncDuckDBConnection,
  arenaPtr: number,
  moleculeId: string | null,
): Promise<number> {
  const { data, itemBytes, count, dim, bitWidth } = ava_codes_view(arenaPtr);
  if (count === 0) return 0;

  const mem = (globalThis as { WebAssembly?: { memory?: WebAssembly.Memory } }).WebAssembly
    ?.memory;
  if (!mem) throw new Error('arena FFI: no shared linear memory');

  const bytes = new Uint8Array(mem.buffer, data, itemBytes * count);
  const resolvedDim = dim ?? itemBytes * 8;
  const resolvedBits = bitWidth ?? 4;

  for (let i = 0; i < count; i++) {
    const slice = bytes.subarray(i * itemBytes, (i + 1) * itemBytes);
    await ingestMailboxSnapshot(
      conn,
      {
        generation: 0,
        dim: resolvedDim,
        bitWidth: resolvedBits,
        codes: slice,
      },
      moleculeId,
      i,
    );
  }
  return count;
}
