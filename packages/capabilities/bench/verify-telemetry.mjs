/**
 * Separate process used to prove telemetry recovery after a restart: it reads a
 * persisted NDJSON file written by an earlier process and reports consistency.
 *
 *   node packages/capabilities/bench/verify-telemetry.mjs <path>
 */
import { recoverJsonl } from '../dist/durable_sink.js';

const path = process.argv[2];
if (!path) {
  process.stderr.write('usage: verify-telemetry.mjs <path>\n');
  process.exit(2);
}

const report = recoverJsonl(path);
process.stdout.write(`${JSON.stringify(report)}\n`);
process.exit(report.ok ? 0 : 1);
