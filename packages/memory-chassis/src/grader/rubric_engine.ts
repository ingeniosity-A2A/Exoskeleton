/**
 * PrismaForge / PrismaCoder-style Elastic Rubric Scorer
 * arXiv 2610.20538v1 — Sun et al.
 *
 * Rubric is both filter and reward. Criteria are binary yes/no items with
 * sample-dependent weights. Execution gatekeeper: fail → score 0, no judge.
 */

export interface RubricItem {
  question: string;
  /** 0.8–1.0 critical, 0.4–0.7 important, 0.1–0.3 minor */
  weight: number;
}

export interface Rubric {
  shared_rubrics: Record<string, RubricItem[]>;
  task_specific_rubrics: Record<string, RubricItem[]>;
  difficulty: 'low' | 'medium' | 'high';
}

export type Modality = 'code' | 'vision';

export type TaskFamily =
  | 'chart'
  | 'web_page'
  | 'svg'
  | 'svg_reproduction'
  | 'interface_edit'
  | 'skill_default';

/** Paper Table 7 λ defaults */
export const TASK_LAMBDAS: Record<
  TaskFamily,
  { c: number; v: number; h?: number }
> = {
  chart: { c: 0.5, v: 0.5 },
  web_page: { c: 0.4, v: 0.6 },
  svg: { c: 0.2, v: 0.8 },
  svg_reproduction: { c: 0.2, v: 0.5, h: 0.3 },
  interface_edit: { c: 0.3, v: 0.3, h: 0.4 },
  skill_default: { c: 0.5, v: 0.5 },
};

export type BinaryJudge = (item: RubricItem, evidence: unknown) => 0 | 1;

function allItems(rubric: Rubric): RubricItem[] {
  return [
    ...Object.values(rubric.shared_rubrics),
    ...Object.values(rubric.task_specific_rubrics),
  ].flat();
}

/** Eq. 2 — normalized modality score */
export function modalityScore(
  rubric: Rubric,
  evidence: unknown,
  judge: BinaryJudge,
): number {
  const items = allItems(rubric);
  const wsum = items.reduce((s, it) => s + it.weight, 0) || 1;
  return items.reduce((s, it) => s + it.weight * judge(it, evidence), 0) / wsum;
}

export interface EvalBreakdown {
  score: number;
  s_code: number;
  s_vision: number;
  gatekeeper_pass: boolean;
  lambda: { c: number; v: number; h?: number };
}

/**
 * Combined score (Eq. 3) + optional holistic λ_h.
 * Gatekeeper fail → reward 0, no judging (App. D / A.2).
 */
export function evalScore(
  rubric: Rubric,
  codeEvidence: unknown,
  visualEvidence: unknown,
  opts: {
    lambda: { c: number; v: number; h?: number };
    judge: BinaryJudge;
    gatekeeperPass: boolean;
    holistic?: number;
  },
): EvalBreakdown {
  if (!opts.gatekeeperPass) {
    return {
      score: 0,
      s_code: 0,
      s_vision: 0,
      gatekeeper_pass: false,
      lambda: opts.lambda,
    };
  }
  const s_code = modalityScore(rubric, codeEvidence, opts.judge);
  const s_vision = modalityScore(rubric, visualEvidence, opts.judge);
  let score = opts.lambda.c * s_code + opts.lambda.v * s_vision;
  if (opts.lambda.h !== undefined && opts.holistic !== undefined) {
    score = score + opts.lambda.h * opts.holistic;
  }
  // Clamp to [0,1] for ledger CHECK constraint
  score = Math.min(1, Math.max(0, score));
  return {
    score,
    s_code,
    s_vision,
    gatekeeper_pass: true,
    lambda: opts.lambda,
  };
}

/** §4.2 Iterative data gating thresholds */
export function gateRoute(
  s: number,
  tau1: number,
  tau2: number,
): 'discard' | 'resynthesize' | 'retain' {
  if (s < tau1) return 'discard';
  if (s < tau2) return 'resynthesize';
  return 'retain';
}

/** Eq. 6 — informativeness U_i over K rollout scores */
export function informativeness(scores: number[]): number {
  if (scores.length === 0) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length;
}

/** Default binary judge: evidence object with answers keyed by question text */
export const defaultJudge: BinaryJudge = (item, evidence) => {
  if (!evidence || typeof evidence !== 'object') return 0;
  const map = evidence as Record<string, unknown>;
  const v = map[item.question];
  if (v === true || v === 1 || v === 'pass' || v === 'yes') return 1;
  return 0;
};
