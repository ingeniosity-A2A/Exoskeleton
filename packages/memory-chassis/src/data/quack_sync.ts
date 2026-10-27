import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

export type QuackOp = {
  seq: number;
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
};

export type QuackAck = { ok: boolean; applied_seq: number; needs_resync?: string[] };

export interface QuackTransport {
  send(env: QuackEnvelope): Promise<QuackAck>;
}

export class QuackNativeTransport implements QuackTransport {
  constructor(private endpoint: string) {}
  async send(env: QuackEnvelope): Promise<QuackAck> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(env),
    });
    if (!res.ok) throw new Error(`quack transport: HTTP ${res.status}`);
    return res.json() as Promise<QuackAck>;
  }
}

const MAX_QUEUE = 4096;
const FLUSH_OPS = 128;
const FLUSH_MS = 150;

export class QuackOutbox {
  private pumping = false;
  private overflowed = false;
  private ackedSeq = 0;

  constructor(
    private conn: AsyncDuckDBConnection,
    private transport: QuackTransport,
    private sourceId: string,
    private orthogonalSeed: number,
    private trace: (e: Record<string, unknown>) => void,
  ) {}

  async start(intervalMs = FLUSH_MS): Promise<void> {
    this.ackedSeq = await this.loadWatermark();
    setInterval(() => void this.pump(), intervalMs);
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
        SELECT * FROM quack_outbox
        WHERE seq > ${this.ackedSeq}
        ORDER BY seq ASC LIMIT ${FLUSH_OPS}`);
      if (pending.numRows === 0) return;

      const ops = this.arrowToOps(pending);
      const env: QuackEnvelope = {
        source_id: this.sourceId,
        orthogonal_seed: this.orthogonalSeed,
        first_seq: ops[0]!.seq,
        last_seq: ops[ops.length - 1]!.seq,
        ops,
        sent_at_ms: performance.now(),
      };

      const backoff = [250, 1000, 4000, 16000];
      for (let attempt = 0; ; attempt++) {
        try {
          const ack = await this.transport.send(env);
          if (!ack.ok) throw new Error('remote rejected batch');
          this.ackedSeq = Math.max(this.ackedSeq, ack.applied_seq);
          await this.saveWatermark(this.ackedSeq);
          this.trace({
            event: 'quack_flush',
            from: env.first_seq,
            to: env.last_seq,
            ops: ops.length,
            rtt_ms: +(performance.now() - env.sent_at_ms).toFixed(2),
            applied_seq: ack.applied_seq,
          });
          if (ack.needs_resync?.length) await this.snapshotResync(ack.needs_resync);
          break;
        } catch (err) {
          if (attempt >= backoff.length - 1) {
            this.trace({
              event: 'quack_retry_exhausted',
              to: env.last_seq,
              err: String(err),
            });
            return;
          }
          await new Promise((r) =>
            setTimeout(r, backoff[attempt]! * (0.8 + Math.random() * 0.4)),
          );
        }
      }
    } finally {
      this.pumping = false;
    }
  }

  private async resync(): Promise<void> {
    const stale = await this.conn.query(
      `SELECT DISTINCT molecule_id FROM quack_outbox WHERE seq > ${this.ackedSeq}`,
    );
    const ids = stale.toArray().map((r: { molecule_id: string }) => r.molecule_id);
    this.overflowed = false;
    await this.snapshotResync(ids);
    this.trace({ event: 'quack_resync', molecules: ids.length });
  }

  private async snapshotResync(moleculeIds: string[]): Promise<void> {
    for (const id of moleculeIds) {
      const set = await this.conn.query(`
        SELECT * FROM atomic_tweens
        WHERE molecule_id = '${id.replace(/'/g, "''")}'
        ORDER BY start_time_ms ASC`);
      await this.transport.send({
        source_id: this.sourceId,
        orthogonal_seed: this.orthogonalSeed,
        first_seq: -1,
        last_seq: -1,
        ops: this.arrowToOps(set).map((o) => ({ ...o, op: 'insert' as const })),
        sent_at_ms: performance.now(),
      });
    }
  }

  private arrowToOps(batch: {
    numRows: number;
    getChildAt: (i: number) => { toArray: () => unknown[] } | null;
  }): QuackOp[] {
    const cols = (i: number) => batch.getChildAt(i)?.toArray() ?? [];
    const n = batch.numRows;
    const out: QuackOp[] = [];
    for (let i = 0; i < n; i++) {
      out.push({
        seq: Number(cols(0)[i]),
        molecule_id: cols(1)[i] as string,
        target_property: cols(2)[i] as string,
        op: cols(3)[i] as QuackOp['op'],
        start_time_ms: (cols(4)[i] as number) ?? null,
        duration_ms: (cols(5)[i] as number) ?? null,
        start_value: (cols(6)[i] as number) ?? null,
        end_value: (cols(7)[i] as number) ?? null,
        easing_code_id: (cols(8)[i] as number) ?? null,
        generation: Number(cols(9)[i]),
      });
    }
    return out;
  }

  private async queueDepth(): Promise<number> {
    const r = await this.conn.query(
      `SELECT COUNT(*)::BIGINT AS n FROM quack_outbox WHERE seq > ${this.ackedSeq}`,
    );
    return Number(r.toArray()[0].n);
  }

  private async loadWatermark(): Promise<number> {
    const r = await this.conn.query(`SELECT acked_seq FROM quack_outbox_ack WHERE id = 1`);
    return Number(r.toArray()[0]?.acked_seq ?? 0);
  }

  private async saveWatermark(s: number): Promise<void> {
    await this.conn.query(`
      INSERT INTO quack_outbox_ack (id, acked_seq) VALUES (1, ${s})
      ON CONFLICT (id) DO UPDATE SET acked_seq = excluded.acked_seq`);
  }
}
