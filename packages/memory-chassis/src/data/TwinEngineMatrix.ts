import type { AsyncDuckDB } from '@duckdb/duckdb-wasm';
import type { AtomicTweenRow } from '../types/CognitiveState';

export class TwinEngineMatrix {
  private isWriting = false;

  constructor(private shortTermDb: AsyncDuckDB) {}

  /** Transactional ingress. Rows arrive pre-mapped (atomToRow) — one shape. */
  async appendTransitionLogTransactional(row: AtomicTweenRow): Promise<void> {
    if (this.isWriting) throw new Error('ingress gate: re-entrant write');
    this.isWriting = true;
    const connection = await this.shortTermDb.connect();

    try {
      const scratch =
        (globalThis as { process?: { env?: { TMPDIR?: string } } }).process?.env?.TMPDIR ??
        '/tmp';
      await connection.query(`
        SET memory_limit = '3GB';
        SET preserve_insertion_order = false;
        SET temp_directory = '${scratch}/duckdb_scratch.tmp';
        SET ava.generation = '${row.orchestrator_generation_id}';
      `);

      await connection.query('BEGIN TRANSACTION');
      await connection.query(
        `INSERT INTO atomic_tweens
           (tween_id, molecule_id, target_property,
            start_value, end_value, start_time_ms, duration_ms,
            easing_code_id, orchestrator_generation_id)
         VALUES ('${row.tween_id}', '${row.molecule_id}', '${row.target_property}',
           ${row.start_value}, ${row.end_value}, ${row.start_time_ms}, ${row.duration_ms},
           ${row.easing_code_id}, ${row.orchestrator_generation_id})`,
      );
      await connection.query('COMMIT');
      // outbox row exists via tg_outbox_insert
    } catch (error) {
      try {
        await connection.query('ROLLBACK');
      } catch {
        /* connection dead — original error is the truth */
      }
      throw new Error(`ingress gate rollback: ${error}`);
    } finally {
      await connection.close();
      this.isWriting = false;
    }
  }
}
