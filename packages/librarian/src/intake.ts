/**
 * REV.IKE intake surface — TypeScript entry that invokes the zero-copy engine.
 * No fake throughput. Fail closed if the engine is unavailable.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export interface IntakeReport {
  total_records: number;
  elapsed_seconds: number;
  throughput_rec_sec: number;
  initial_rss_mb?: number;
  peak_rss_mb?: number;
  final_rss_mb?: number;
  rss_delta_mb?: number;
  peak_python_heap_mb?: number;
}

function enginePath(): string {
  // packages/librarian/src -> repo root engine/rev_ike.py
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../../engine/rev_ike.py');
}

/**
 * Run zero-copy intake via engine/rev_ike.py.
 * Returns measured report JSON from the engine process.
 */
export async function runZeroCopyIntake(
  totalRecords: number = 10_000,
): Promise<IntakeReport> {
  const script = enginePath();
  const report = await new Promise<IntakeReport>((resolve, reject) => {
    const child = spawn(
      'python3',
      ['-c', `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.dirname(script))})
from rev_ike import RevIkeZeroCopyIntake
r = RevIkeZeroCopyIntake().execute_zero_copy_ingestion(${totalRecords})
print(json.dumps(r))
`],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d.toString();
    });
    child.stderr.on('data', (d) => {
      err += d.toString();
    });
    child.on('error', (e) => reject(e));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `rev_ike intake failed (exit ${code}): ${err || out || 'no output'}`,
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(out.trim()) as IntakeReport);
      } catch (e) {
        reject(new Error(`rev_ike output not JSON: ${out.slice(0, 200)}`));
      }
    });
  });
  return report;
}
