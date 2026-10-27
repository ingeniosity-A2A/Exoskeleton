import type { QuackEnvelope, QuackAck } from './quack_sync';

export class QuackApply {
  constructor(
    private db: {
      run: (sql: string, params?: unknown[]) => Promise<unknown[]>;
      tx: (fn: (t: { run: (sql: string, params?: unknown[]) => Promise<unknown> }) => Promise<void>) => Promise<void>;
    },
    private trace: (e: Record<string, unknown>) => void,
  ) {}

  async apply(env: QuackEnvelope): Promise<QuackAck> {
    const rows = await this.db.run(
      `SELECT applied_seq FROM quack_apply_watermark WHERE source_id = ?`,
      [env.source_id],
    );
    const wm = rows[0] as { applied_seq?: number } | undefined;
    const applied = Number(wm?.applied_seq ?? 0);
    const isSnapshot = env.first_seq === -1;
    const fresh = env.ops.filter((o) => isSnapshot || o.seq > applied);
    if (fresh.length === 0) return { ok: true, applied_seq: applied };

    await this.db.tx(async (t) => {
      for (const o of fresh) {
        if (o.op === 'purge') {
          await t.run(
            `DELETE FROM atomic_tweens
              WHERE molecule_id = ? AND target_property = ? AND start_time_ms >= ?`,
            [o.molecule_id, o.target_property, o.start_time_ms],
          );
        } else if (o.op === 'truncate') {
          await t.run(
            `UPDATE atomic_tweens
                SET end_value = ?, duration_ms = ? - start_time_ms
              WHERE molecule_id = ? AND target_property = ?
                AND start_time_ms + duration_ms > ?`,
            [
              o.end_value,
              o.start_time_ms,
              o.molecule_id,
              o.target_property,
              o.start_time_ms,
            ],
          );
        } else {
          await t.run(
            `INSERT OR REPLACE INTO atomic_tweens
               (tween_id, molecule_id, target_property,
                start_value, end_value, start_time_ms, duration_ms, easing_code_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              `q:${env.source_id}:${o.seq}`,
              o.molecule_id,
              o.target_property,
              o.start_value,
              o.end_value,
              o.start_time_ms,
              o.duration_ms,
              o.easing_code_id ?? 0,
            ],
          );
        }
      }
      await t.run(
        `INSERT INTO quack_apply_watermark (source_id, applied_seq, applied_at)
         VALUES (?, ?, ?)
         ON CONFLICT (source_id) DO UPDATE SET applied_seq = excluded.applied_seq`,
        [env.source_id, isSnapshot ? applied : env.last_seq, Date.now()],
      );
    });

    this.trace({
      event: 'quack_apply',
      from: env.first_seq,
      to: env.last_seq,
      applied: fresh.length,
      snapshot: isSnapshot,
    });
    return { ok: true, applied_seq: isSnapshot ? applied : env.last_seq };
  }
}
