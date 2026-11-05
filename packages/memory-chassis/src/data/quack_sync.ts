import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

export type QuackOp = {
  seq: number;
  tween_id: string | null;
  molecule_id: string;
  target_property: string;
  op: 'insert' | 'truncate' | 'purge';
  start_time_ms: number | null;
  duration_ms: number | null;
  start_value: number | null;
  end_value: number | null;
  easing_code_id: number | null;
  generation: number;
};

export type QuackEnvelope = {
  source_id: string;
  orthogonal_seed: number;
  first_seq: number;
  last_seq: number;
  ops: QuackOp[];
  sent_at_ms: number;
  /** Full replacement snapshot scope. Empty ops is meaningful for an empty molecule. */
  snapshot_molecules?: string[];
};

export type QuackAck = { ok: boolean; applied_seq: number; needs_resync?: string[] };

export interface QuackTransport {
  send(env: QuackEnvelope): Promise<QuackAck>;
}

export class QuackNativeTransport implements QuackTransport {
  constructor(private endpoint: string) {}
  async send(env: QuackEnvelope): Promise<QuackAck> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(env),
    });
    if (!response.ok) throw new Error(`quack transport: HTTP ${response.status}`);
    return response.json() as Promise<QuackAck>;
  }
}

const MAX_QUEUE = 4096;
const FLUSH_OPS = 128;
const FLUSH_MS = 150;

export class QuackOutbox {
  private pumping = false;
  private overflowed = false;
  private ackedSeq = 0;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private conn: AsyncDuckDBConnection,
    private transport: QuackTransport,
    private sourceId: string,
    private orthogonalSeed: number,
    private trace: (event: Record<string, unknown>) => void,
  ) {}

  async start(intervalMs = FLUSH_MS): Promise<void> {
    if (this.timer) return;
    this.ackedSeq = await this.loadWatermark();
    this.timer = setInterval(() => { void this.pump(); }, intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async onCommit(): Promise<void> {
    const depth = await this.queueDepth();
    if (depth > MAX_QUEUE) {
      this.overflowed = true;
      this.trace({ event: 'quack_overflow', depth });
      return;
    }
    if (depth >= FLUSH_OPS) void this.pump();
  }

  async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      if (this.overflowed) {
        await this.resync();
        return;
      }

      const pending = await this.conn.query(`
        SELECT seq, tween_id, molecule_id, target_property, op,
               start_time_ms, duration_ms, start_value, end_value,
               easing_code_id, generation
          FROM quack_outbox
         WHERE seq > ${this.ackedSeq}
         ORDER BY seq ASC LIMIT ${FLUSH_OPS}`);
      if (pending.numRows === 0) return;

      const ops = this.arrowToOps(pending);
      const envelope: QuackEnvelope = {
        source_id: this.sourceId,
        orthogonal_seed: this.orthogonalSeed,
        first_seq: ops[0]!.seq,
        last_seq: ops[ops.length - 1]!.seq,
        ops,
        sent_at_ms: Date.now(),
      };

      const delays = [250, 1000, 4000, 16000];
      for (let attempt = 0; ; attempt++) {
        try {
          const ack = await this.transport.send(envelope);
          if (!ack.ok || ack.applied_seq < envelope.first_seq
              || ack.applied_seq > envelope.last_seq) {
            throw new Error('invalid or rejected Quack acknowledgement');
          }
          this.ackedSeq = Math.max(this.ackedSeq, ack.applied_seq);
          await this.saveWatermark(this.ackedSeq);
          this.trace({
            event: 'quack_flush', from: envelope.first_seq, to: envelope.last_seq,
            count: ops.length, applied_seq: ack.applied_seq,
          });
          if (ack.needs_resync?.length) await this.snapshotResync(ack.needs_resync);
          break;
        } catch (error) {
          if (attempt >= delays.length - 1) {
            this.trace({ event: 'quack_retry_exhausted', to: envelope.last_seq, error: String(error) });
            return;
          }
          const jitter = 0.8 + Math.random() * 0.4;
          await new Promise(resolve => setTimeout(resolve, delays[attempt]! * jitter));
        }
      }
    } finally {
      this.pumping = false;
    }
  }

  private async resync(): Promise<void> {
    const result = await this.conn.query(
      `SELECT DISTINCT molecule_id FROM quack_outbox WHERE seq > ${this.ackedSeq}`,
    );
    const ids = result.toArray().map((row: { molecule_id: string }) => row.molecule_id);
    await this.snapshotResync(ids);
    this.overflowed = false;
    this.trace({ event: 'quack_resync', molecules: ids.length });
  }

  private async snapshotResync(moleculeIds: string[]): Promise<void> {
    for (const id of [...new Set(moleculeIds)]) {
      const result = await this.conn.query(`
        SELECT CAST(-1 AS BIGINT) AS seq, tween_id, molecule_id, target_property,
               'insert' AS op, start_time_ms, duration_ms, start_value, end_value,
               easing_code_id, orchestrator_generation_id AS generation
          FROM atomic_tweens
         WHERE molecule_id = ${this.sqlString(id)}
         ORDER BY start_time_ms ASC, tween_id ASC`);
      const ops = this.arrowToOps(result);
      await this.transport.send({
        source_id: this.sourceId,
        orthogonal_seed: this.orthogonalSeed,
        first_seq: -1,
        last_seq: -1,
        ops,
        snapshot_molecules: [id],
        sent_at_ms: Date.now(),
      });
    }
  }

  private sqlString(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  private arrowToOps(batch: {
    numRows: number;
    getChild: (name: string) => { toArray(): unknown[] } | null;
  }): QuackOp[] {
    const column = (name: string) => {
      const values = batch.getChild(name)?.toArray();
      if (!values) throw new Error(`Quack batch missing column: ${name}`);
      if (values.length !== batch.numRows) throw new Error(`Quack column length mismatch: ${name}`);
      return values;
    };
    const seq = column('seq'), tween = column('tween_id'), molecule = column('molecule_id');
    const property = column('target_property'), op = column('op');
    const start = column('start_time_ms'), duration = column('duration_ms');
    const startValue = column('start_value'), endValue = column('end_value');
    const easing = column('easing_code_id'), generation = column('generation');

    return Array.from({ length: batch.numRows }, (_, i) => ({
      seq: Number(seq[i]),
      tween_id: tween[i] == null ? null : String(tween[i]),
      molecule_id: String(molecule[i]),
      target_property: String(property[i]),
      op: String(op[i]) as QuackOp['op'],
      start_time_ms: start[i] == null ? null : Number(start[i]),
      duration_ms: duration[i] == null ? null : Number(duration[i]),
      start_value: startValue[i] == null ? null : Number(startValue[i]),
      end_value: endValue[i] == null ? null : Number(endValue[i]),
      easing_code_id: easing[i] == null ? null : Number(easing[i]),
      generation: Number(generation[i]),
    }));
  }

  private async queueDepth(): Promise<number> {
    const result = await this.conn.query(
      `SELECT COUNT(*)::BIGINT AS n FROM quack_outbox WHERE seq > ${this.ackedSeq}`,
    );
    return Number(result.toArray()[0]?.n ?? 0);
  }

  private async loadWatermark(): Promise<number> {
    const result = await this.conn.query(
      'SELECT acked_seq FROM quack_outbox_ack WHERE id = 1',
    );
    return Number(result.toArray()[0]?.acked_seq ?? 0);
  }

  private async saveWatermark(sequence: number): Promise<void> {
    await this.conn.query(`
      INSERT INTO quack_outbox_ack (id, acked_seq) VALUES (1, ${sequence})
      ON CONFLICT (id) DO UPDATE SET acked_seq = excluded.acked_seq`);
  }
}
