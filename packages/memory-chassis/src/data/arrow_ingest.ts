import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

export interface ArenaView {
  data: number;
  itemBytes: number;
  count: number;
  dim?: number;
  bitWidth?: number;
}

declare function ava_codes_view(arena: number): ArenaView;

/**
 * Arena values buffer IS the Arrow values buffer.
 * Copies exactly once into DuckDB columnar blocks.
 * Query and GPU consumers of the arena stay zero-copy.
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
    const hex = Array.from(slice)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await conn.query(
      `INSERT INTO turboquant_blocks (block_id, molecule_id, dim, bit_width, codes)
       VALUES (${i}, ${moleculeId ? `'${moleculeId.replace(/'/g, "''")}'` : 'NULL'},
               ${resolvedDim}, ${resolvedBits}, X'${hex}')`,
    );
  }
  return count;
}
