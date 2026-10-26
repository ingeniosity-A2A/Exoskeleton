/**
 * MVCC-safe transition commit path (latest-wins).
 * Layer 1b only. No cognitive logic.
 */

export interface TransitionInput {
  moleculeId: string;
  property: string;
  newValue: number;
  startTimeMs: number;
  durationMs: number;
  easingCodeId?: number;
}

export interface TransitionCommitResult {
  tweenId: string;
  truncated: number;
  deleted: number;
}

/**
 * Latest-wins temporal commit.
 *
 * 1. Evaluate baseline at the insertion point (lazy read).
 * 2. Delete any future-straddling nodes fully invalidated by the write.
 * 3. Truncate active nodes that the new transition cuts short.
 * 4. Insert the new compressed transition edge.
 *
 * Callers supply a DuckDB connection / transaction handle.
 * This module does not open connections.
 */
export function buildLatestWinsBatch(input: TransitionInput, baseline: number) {
  const tweenId = crypto.randomUUID();
  const easing = input.easingCodeId ?? 1;

  const deleteFuture = {
    sql: `
      DELETE FROM atomic_tweens
      WHERE molecule_id = ? AND target_property = ? AND start_time_ms >= ?
    `,
    params: [input.moleculeId, input.property, input.startTimeMs],
  };

  const truncateActive = {
    sql: `
      UPDATE atomic_tweens
      SET end_value = ?, duration_ms = ? - start_time_ms
      WHERE molecule_id = ?
        AND target_property = ?
        AND start_time_ms + duration_ms > ?
        AND start_time_ms < ?
    `,
    params: [
      baseline,
      input.startTimeMs,
      input.moleculeId,
      input.property,
      input.startTimeMs,
      input.startTimeMs,
    ],
  };

  const insertNew = {
    sql: `
      INSERT INTO atomic_tweens (
        tween_id, molecule_id, target_property,
        start_value, end_value, start_time_ms, duration_ms, easing_code_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    params: [
      tweenId,
      input.moleculeId,
      input.property,
      baseline,
      input.newValue,
      input.startTimeMs,
      input.durationMs,
      easing,
    ],
  };

  return { tweenId, statements: [deleteFuture, truncateActive, insertNew] };
}

export function buildBaselineQuery(
  moleculeId: string,
  property: string,
  timeMs: number
) {
  return {
    sql: `
      SELECT end_value
      FROM atomic_tweens
      WHERE molecule_id = ? AND target_property = ? AND start_time_ms < ?
      ORDER BY start_time_ms DESC
      LIMIT 1
    `,
    params: [moleculeId, property, timeMs],
  };
}
