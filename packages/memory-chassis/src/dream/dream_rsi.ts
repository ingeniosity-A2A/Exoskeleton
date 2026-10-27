/**
 * Dream-RSI Replay Simulator
 * Legible scoring: similarity-weighted historical mean (not a black box).
 * Refuses to invent resolutions with insufficient history.
 */

import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import type { TweenAtom, AvaCognitiveState } from '../types/CognitiveState';

export interface TurboVecIndex {
  search(codes: Uint8Array, k: number): Array<{ blockId: number; score: number }>;
}

export interface PathSimulatorHandle {
  collapse(amplitudes: number[], seed: number): number;
}

export interface DreamResult {
  session_id: string;
  atom: TweenAtom | null;
  predicted_score: number;
  candidate_count: number;
  fallback: 'none' | 'insufficient-history' | 'flat-amplitudes';
}

interface AnalogRow {
  analog_tween_id: string;
  analog_molecule_id: string;
  target_property: string;
  end_value: number;
  eval_score: number;
  similarity: number;
}

const MIN_ANALOGS = 3;
const DREAM_DURATION_MS = 400;
const FLAT_EPS = 1e-6;

export class DreamRSI {
  constructor(
    private ledger: AsyncDuckDBConnection,
    private vectors: TurboVecIndex,
    private paths: PathSimulatorHandle,
    private trace: (e: Record<string, unknown>) => void,
  ) {}

  async dream(
    signatureCodes: Uint8Array,
    signatureBlockId: number,
    moleculeId: string,
    capabilityClass: string,
    seed: number,
  ): Promise<DreamResult> {
    const t0 = performance.now();
    const sessionId = crypto.randomUUID();

    const hits = this.vectors.search(signatureCodes, 16);
    if (hits.length < MIN_ANALOGS) {
      this.trace({
        event: 'dream_fallback',
        session_id: sessionId,
        reason: 'insufficient-history',
        analogs: hits.length,
      });
      return {
        session_id: sessionId,
        atom: null,
        predicted_score: 0,
        candidate_count: 0,
        fallback: 'insufficient-history',
      };
    }

    const blockIds = hits.map((h) => h.blockId).join(',');
    const simById = new Map(hits.map((h) => [h.blockId, h.score]));

    const q = await this.ledger.query(`
      SELECT l.transaction_id AS analog_tween_id,
             l.capability_name AS analog_molecule_id,
             t.target_property AS target_property,
             t.end_value AS end_value,
             l.eval_score AS eval_score,
             b.block_id AS block_id
        FROM turboquant_blocks b
        JOIN atomic_tweens t ON t.molecule_id = b.molecule_id
        JOIN embedded_skill_execution_ledger l
             ON l.orchestrator_generation_id = t.orchestrator_generation_id
       WHERE b.block_id IN (${blockIds})
       ORDER BY l.eval_score DESC
       LIMIT 32`);

    const analogs: AnalogRow[] = q.toArray().map((r: Record<string, unknown>) => ({
      analog_tween_id: String(r.analog_tween_id),
      analog_molecule_id: String(r.analog_molecule_id),
      target_property: String(r.target_property),
      end_value: Number(r.end_value),
      eval_score: Number(r.eval_score),
      similarity: simById.get(Number(r.block_id)) ?? 0.5,
    }));

    if (analogs.length < MIN_ANALOGS) {
      this.trace({
        event: 'dream_fallback',
        session_id: sessionId,
        reason: 'insufficient-history',
        analogs: analogs.length,
      });
      return {
        session_id: sessionId,
        atom: null,
        predicted_score: 0,
        candidate_count: 0,
        fallback: 'insufficient-history',
      };
    }

    const clusters = new Map<string, AnalogRow[]>();
    for (const a of analogs) {
      const key = `${a.target_property}|${a.end_value.toFixed(4)}`;
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key)!.push(a);
    }

    type Cand = {
      path_id: number;
      target_property: string;
      target_value: number;
      analog_tween_id: string;
      analog_molecule_id: string;
      replay_score: number;
      rank: number;
    };

    const candidates: Cand[] = [...clusters.entries()]
      .map(([, rows], pathId) => {
        const wsum = rows.reduce((s, r) => s + r.similarity, 0) || FLAT_EPS;
        const replayScore =
          rows.reduce((s, r) => s + r.similarity * r.eval_score, 0) / wsum;
        return {
          path_id: pathId,
          target_property: rows[0]!.target_property,
          target_value: rows[0]!.end_value,
          analog_tween_id: rows[0]!.analog_tween_id,
          analog_molecule_id: rows[0]!.analog_molecule_id,
          replay_score: replayScore,
          rank: 0,
        };
      })
      .sort((a, b) => b.replay_score - a.replay_score);
    candidates.forEach((c, i) => {
      c.rank = i;
    });

    const amplitudes = candidates.map((c) =>
      Math.sqrt(Math.max(c.replay_score, FLAT_EPS)),
    );
    const flat = amplitudes.every((a) => Math.abs(a - amplitudes[0]!) < FLAT_EPS);
    const chosenIdx = flat ? 0 : this.paths.collapse(amplitudes, seed);
    const chosen = candidates[chosenIdx]!;
    const predictedScore = chosen.replay_score;

    await this.ledger.query('BEGIN TRANSACTION');
    try {
      await this.ledger.query(`
        INSERT INTO dream_sessions
          (session_id, seed, signature_block_id, molecule_id,
           capability_class, candidate_count, chosen_path_id, predicted_score)
        VALUES ('${sessionId}', ${seed}, ${signatureBlockId},
          '${moleculeId.replace(/'/g, "''")}',
          '${capabilityClass.replace(/'/g, "''")}',
          ${candidates.length}, ${chosen.path_id}, ${predictedScore})`);
      for (const c of candidates) {
        await this.ledger.query(`
          INSERT INTO dream_candidates
            (session_id, path_id, analog_tween_id, analog_molecule_id,
             target_property, target_value, replay_score, rank)
          VALUES ('${sessionId}', ${c.path_id},
            '${String(c.analog_tween_id).replace(/'/g, "''")}',
            '${String(c.analog_molecule_id).replace(/'/g, "''")}',
            '${c.target_property.replace(/'/g, "''")}',
            ${c.target_value}, ${c.replay_score}, ${c.rank})`);
      }
      await this.ledger.query('COMMIT');
    } catch (e) {
      try {
        await this.ledger.query('ROLLBACK');
      } catch {
        /* */
      }
      throw e;
    }

    const atom: TweenAtom = {
      targetState: {
        [chosen.target_property]: chosen.target_value,
      } as Partial<AvaCognitiveState>,
      easingWavefunction: 'cahnHilliard.spinodal',
      cognitiveWeight: predictedScore,
      startTimeMs: Date.now(),
      durationMs: DREAM_DURATION_MS,
    };

    this.trace({
      event: 'dream_complete',
      session_id: sessionId,
      analogs: analogs.length,
      candidates: candidates.length,
      chosen_path: chosen.path_id,
      predicted_score: +predictedScore.toFixed(4),
      wall_ms: +(performance.now() - t0).toFixed(2),
    });

    return {
      session_id: sessionId,
      atom,
      predicted_score: predictedScore,
      candidate_count: candidates.length,
      fallback: flat ? 'flat-amplitudes' : 'none',
    };
  }

  async closeSession(
    sessionId: string,
    actualScore: number,
    errorThreshold = 0.25,
  ): Promise<{ error: number; modelFalsified: boolean }> {
    const sid = sessionId.replace(/'/g, "''");
    await this.ledger.query(`
      UPDATE dream_sessions
         SET actual_score = ${actualScore},
             prediction_error = abs(predicted_score - ${actualScore}),
             completed_at = CAST(epoch_ms(now()) AS BIGINT)
       WHERE session_id = '${sid}'`);

    const rowQ = await this.ledger.query(
      `SELECT prediction_error, capability_class FROM dream_sessions WHERE session_id = '${sid}'`,
    );
    const row = rowQ.toArray()[0] as
      | { prediction_error?: number; capability_class?: string }
      | undefined;
    const error = Number(row?.prediction_error ?? 0);
    const cls = String(row?.capability_class ?? 'generic').replace(/'/g, "''");

    const rollQ = await this.ledger.query(`
      SELECT AVG(prediction_error) AS e FROM (
        SELECT prediction_error FROM dream_sessions
         WHERE capability_class = '${cls}' AND prediction_error IS NOT NULL
         ORDER BY created_at DESC LIMIT 25)`);
    const rolling = Number(rollQ.toArray()[0]?.e ?? 0);
    const modelFalsified = rolling > errorThreshold;

    this.trace({
      event: 'dream_close',
      session_id: sessionId,
      class: cls,
      predicted_error: +error.toFixed(4),
      rolling_error: +rolling.toFixed(4),
      model_falsified: modelFalsified,
    });

    return { error, modelFalsified };
  }
}

/** Deterministic path collapse when native PathSimulator is unavailable */
export function seedCollapse(amplitudes: number[], seed: number): number {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const sum = amplitudes.reduce((a, b) => a + b, 0) || 1;
  let r = rand() * sum;
  for (let i = 0; i < amplitudes.length; i++) {
    r -= amplitudes[i]!;
    if (r <= 0) return i;
  }
  return amplitudes.length - 1;
}
