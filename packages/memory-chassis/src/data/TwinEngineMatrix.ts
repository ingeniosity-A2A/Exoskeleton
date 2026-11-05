import type { AsyncDuckDB } from '@duckdb/duckdb-wasm';
import type { AtomicTweenRow } from '../types/CognitiveState';

const quoteSql = (value: string): string => `'${value.replace(/'/g, "''")}'`;
const finite = (value: number, field: string): number => {
  if (!Number.isFinite(value)) throw new Error(`${field} must be finite`);
  return value;
};

export class TwinEngineMatrix {
  private isWriting = false;

  constructor(private shortTermDb: AsyncDuckDB) {}

  /** Transactional ingress. The lock is always released, including connect failure. */
  async appendTransitionLogTransactional(row: AtomicTweenRow): Promise<void> {
    if (this.isWriting) throw new Error('ingress gate: re-entrant write');
    this.isWriting = true;
    let connection: Awaited<ReturnType<AsyncDuckDB['connect']>> | undefined;
    let transactionOpen = false;

    try {
      if (!row.tween_id || !row.molecule_id || !row.target_property) {
        throw new Error('ingress gate: tween, molecule and property IDs are required');
      }
      finite(row.start_value, 'start_value');
      finite(row.end_value, 'end_value');
      finite(row.start_time_ms, 'start_time_ms');
      finite(row.duration_ms, 'duration_ms');
      if (row.duration_ms <= 0) throw new Error('duration_ms must be positive');
      if (!Number.isSafeInteger(row.orchestrator_generation_id)
          || row.orchestrator_generation_id < 0) {
        throw new Error('generation must be a non-negative safe integer');
      }

      connection = await this.shortTermDb.connect();
      const scratch = (
        globalThis as { process?: { env?: { TMPDIR?: string } } }
      ).process?.env?.TMPDIR ?? '/tmp';
      await connection.query(`
        SET memory_limit = '3GB';
        SET preserve_insertion_order = false;
        SET temp_directory = ${quoteSql(`${scratch.replace(/'/g, "''")}/duckdb_scratch.tmp`)};
      `);

      await connection.query('BEGIN TRANSACTION');
      transactionOpen = true;
      await connection.query(`
        INSERT INTO atomic_tweens
          (tween_id, molecule_id, target_property,
           start_value, end_value, start_time_ms, duration_ms,
           easing_code_id, orchestrator_generation_id)
        VALUES (
          ${quoteSql(row.tween_id)},
          ${quoteSql(row.molecule_id)},
          ${quoteSql(row.target_property)},
          ${finite(row.start_value, 'start_value')},
          ${finite(row.end_value, 'end_value')},
          ${finite(row.start_time_ms, 'start_time_ms')},
          ${finite(row.duration_ms, 'duration_ms')},
          ${row.easing_code_id},
          ${row.orchestrator_generation_id}
        )
      `);
      await connection.query('COMMIT');
      transactionOpen = false;
    } catch (error) {
      if (connection && transactionOpen) {
        try { await connection.query('ROLLBACK'); } catch { /* preserve original error */ }
      }
      throw new Error(`ingress gate rollback: ${String(error)}`);
    } finally {
      if (connection) {
        try { await connection.close(); } finally { this.isWriting = false; }
      } else {
        this.isWriting = false;
      }
    }
  }
}
