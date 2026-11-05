import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

export interface MailboxSnapshot {
  generation: number;
  dim: number;
  bitWidth: number;
  codes: Uint8Array;
}

export interface ArenaView {
  /** Byte offset into the explicitly supplied WebAssembly.Memory. */
  data: number;
  itemBytes: number;
  count: number;
  dim: number;
  bitWidth: number;
  generation: number;
}

export async function ingestMailboxSnapshot(
  conn: AsyncDuckDBConnection,
  snapshot: MailboxSnapshot,
  moleculeId: string | null,
  blockId: number,
): Promise<void> {
  validateMetadata(snapshot.dim, snapshot.bitWidth, snapshot.codes.byteLength);
  if (!Number.isSafeInteger(blockId) || blockId < 0) throw new Error('invalid blockId');
  if (!Number.isSafeInteger(snapshot.generation) || snapshot.generation < 0) {
    throw new Error('invalid mailbox generation');
  }
  const hex = Array.from(snapshot.codes, byte => byte.toString(16).padStart(2, '0')).join('');
  const molecule = moleculeId == null ? 'NULL' : quoteSql(moleculeId);
  await conn.query(`
    INSERT INTO turboquant_blocks (block_id, molecule_id, dim, bit_width, codes)
    VALUES (${blockId}, ${molecule}, ${snapshot.dim}, ${snapshot.bitWidth}, X'${hex}')`);
}

/**
 * Wasm-only FFI ingestion. A native process pointer is NOT a Wasm offset.
 * The caller must supply the exact memory exported by the same Wasm instance.
 */
export async function ingestArenaBlocks(
  conn: AsyncDuckDBConnection,
  arenaPtr: number,
  moleculeId: string | null,
  memory: WebAssembly.Memory,
  firstBlockId: number,
  viewArena: (arena: number) => ArenaView,
): Promise<number> {
  if (!Number.isSafeInteger(arenaPtr) || arenaPtr <= 0) throw new Error('invalid arena handle');
  if (!Number.isSafeInteger(firstBlockId) || firstBlockId < 0) throw new Error('invalid firstBlockId');
  const view = viewArena(arenaPtr);
  if (!Number.isSafeInteger(view.data) || view.data < 0
      || !Number.isSafeInteger(view.itemBytes) || view.itemBytes <= 0
      || !Number.isSafeInteger(view.count) || view.count < 0) {
    throw new Error('invalid arena view');
  }
  validateMetadata(view.dim, view.bitWidth, view.itemBytes);
  const totalBytes = view.itemBytes * view.count;
  if (!Number.isSafeInteger(totalBytes) || view.data + totalBytes > memory.buffer.byteLength) {
    throw new Error('arena view exceeds exported Wasm linear memory');
  }
  if (firstBlockId + view.count - 1 > Number.MAX_SAFE_INTEGER) {
    throw new Error('block ID range overflow');
  }

  // Materialize the bytes before issuing async DB operations. This avoids
  // retaining a view into growable Wasm memory across an await.
  const source = new Uint8Array(memory.buffer, view.data, totalBytes);
  const blocks = Array.from({ length: view.count }, (_, index) =>
    source.slice(index * view.itemBytes, (index + 1) * view.itemBytes));
  for (let index = 0; index < blocks.length; index++) {
    await ingestMailboxSnapshot(
      conn,
      {
        generation: view.generation,
        dim: view.dim,
        bitWidth: view.bitWidth,
        codes: blocks[index]!,
      },
      moleculeId,
      firstBlockId + index,
    );
  }
  return view.count;
}

function validateMetadata(dim: number, bitWidth: number, byteLength: number): void {
  if (!Number.isSafeInteger(dim) || dim <= 0 || dim % 8 !== 0) {
    throw new Error('dim must be a positive multiple of 8');
  }
  if (!Number.isInteger(bitWidth) || bitWidth < 2 || bitWidth > 4) {
    throw new Error('bitWidth must be in range 2..4');
  }
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0) {
    throw new Error('packed code block must not be empty');
  }
}

function quoteSql(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
