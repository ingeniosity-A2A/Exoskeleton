import type { QuackEnvelope, QuackAck, QuackOp } from './quack_sync';

type DbTx = {
  run: (sql: string, params?: unknown[]) => Promise<unknown>;
};

export class QuackApply {
  constructor(
    private db: {
      run: (sql: string, params?: unknown[]) => Promise<unknown[]>;
      tx: (fn: (transaction: DbTx) => Promise<void>) => Promise<void>;
    },
    private trace: (event: Record<string, unknown>) => void,
  ) {}

  async apply(envelope: QuackEnvelope): Promise<QuackAck> {
    if (!envelope.source_id) throw new Error('Quack source_id is required');
    const snapshotMolecules = envelope.snapshot_molecules ?? [];
    const isSnapshot = envelope.first_seq === -1 && envelope.last_seq === -1
      && snapshotMolecules.length > 0;

    const watermarkRows = await this.db.run(
      'SELECT applied_seq FROM quack_apply_watermark WHERE source_id = ?',
      [envelope.source_id],
    );
    const applied = Number((watermarkRows[0] as { applied_seq?: number } | undefined)?.applied_seq ?? 0);

    if (!isSnapshot) {
      if (!Number.isSafeInteger(envelope.first_seq) || !Number.isSafeInteger(envelope.last_seq)
          || envelope.first_seq <= 0 || envelope.last_seq < envelope.first_seq) {
        throw new Error('invalid Quack sequence range');
      }
      const fresh = envelope.ops.filter(op => op.seq > applied);
      if (fresh.length === 0) return { ok: true, applied_seq: applied };
      if (fresh.some(op => !Number.isSafeInteger(op.seq) || op.seq <= 0)) {
        throw new Error('invalid Quack operation sequence');
      }

      await this.db.tx(async transaction => {
        for (const operation of fresh) {
          await this.applyOperation(transaction, operation);
        }
        await transaction.run(
          `INSERT INTO quack_apply_watermark (source_id, applied_seq, applied_at)
           VALUES (?, ?, ?)
           ON CONFLICT (source_id) DO UPDATE SET
             applied_seq = excluded.applied_seq, applied_at = excluded.applied_at`,
          [envelope.source_id, envelope.last_seq, Date.now()],
        );
      });

      this.trace({
        event: 'quack_apply', from: envelope.first_seq, to: envelope.last_seq,
        applied: fresh.length, snapshot: false,
      });
      return { ok: true, applied_seq: envelope.last_seq };
    }

    // Snapshot semantics: replace each explicitly named molecule atomically.
    // An empty snapshot is meaningful and deletes stale replica rows.
    const allowed = new Set(snapshotMolecules);
    if (envelope.ops.some(op => !allowed.has(op.molecule_id) || op.op !== 'insert')) {
      throw new Error('snapshot contains an operation outside its replacement scope');
    }
    await this.db.tx(async transaction => {
      for (const moleculeId of snapshotMolecules) {
        await transaction.run('DELETE FROM atomic_tweens WHERE molecule_id = ?', [moleculeId]);
      }
      for (const operation of envelope.ops) {
        await this.applyInsert(transaction, operation);
      }
    });

    this.trace({
      event: 'quack_apply', from: -1, to: -1,
      applied: envelope.ops.length, snapshot: true, molecules: snapshotMolecules.length,
    });
    return { ok: true, applied_seq: applied };
  }

  private async applyOperation(transaction: DbTx, operation: QuackOp): Promise<void> {
    if (operation.op === 'purge') {
      if (operation.tween_id) {
        await transaction.run('DELETE FROM atomic_tweens WHERE tween_id = ?', [operation.tween_id]);
      } else {
        await transaction.run(
          `DELETE FROM atomic_tweens
            WHERE molecule_id = ? AND target_property = ? AND start_time_ms >= ?`,
          [operation.molecule_id, operation.target_property, operation.start_time_ms],
        );
      }
      return;
    }

    if (operation.op === 'truncate') {
      if (operation.start_time_ms == null || operation.end_value == null) {
        throw new Error('truncate operation missing boundary/value');
      }
      const sql = operation.tween_id
        ? `UPDATE atomic_tweens SET end_value = ?, duration_ms = ? - start_time_ms,
             orchestrator_generation_id = ? WHERE tween_id = ?`
        : `UPDATE atomic_tweens SET end_value = ?, duration_ms = ? - start_time_ms,
             orchestrator_generation_id = ? WHERE molecule_id = ? AND target_property = ?
             AND start_time_ms + duration_ms > ?`;
      const params = operation.tween_id
        ? [operation.end_value, operation.start_time_ms, operation.generation, operation.tween_id]
        : [operation.end_value, operation.start_time_ms, operation.generation,
           operation.molecule_id, operation.target_property, operation.start_time_ms];
      await transaction.run(sql, params);
      return;
    }

    await this.applyInsert(transaction, operation);
  }

  private async applyInsert(
    transaction: DbTx,
    operation: QuackOp,
  ): Promise<void> {
    if (!operation.tween_id || operation.start_time_ms == null
        || operation.duration_ms == null || operation.start_value == null
        || operation.end_value == null) {
      throw new Error('insert operation missing required transition fields');
    }
    await transaction.run(
      `INSERT OR REPLACE INTO atomic_tweens
        (tween_id, molecule_id, target_property,
         start_value, end_value, start_time_ms, duration_ms,
         easing_code_id, orchestrator_generation_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        operation.tween_id,
        operation.molecule_id,
        operation.target_property,
        operation.start_value,
        operation.end_value,
        operation.start_time_ms,
        operation.duration_ms,
        operation.easing_code_id ?? 0,
        operation.generation,
      ],
    );
  }
}
