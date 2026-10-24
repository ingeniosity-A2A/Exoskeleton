#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const usage = "Usage: node scripts/benchmark-gate.mjs <validate|gate> <result.json> [--max-regression-percent=N]";
const statuses = new Set(["PASS", "FAIL", "BLOCKED", "NOT_RUN"]);
const domains = new Set(["code", "ui", "memory", "edge", "orchestration"]);
function validate(r) {
  const e = [];
  if (!r || typeof r !== "object" || Array.isArray(r)) return ["root must be an object"];
  for (const k of ["schemaVersion","benchmarkId","domain","commit","environment","status","metrics","checks","timestamp"]) if (!(k in r)) e.push(`missing required field: ${k}`);
  if (r.schemaVersion !== "1.0.0") e.push("schemaVersion must be 1.0.0");
  if (typeof r.benchmarkId !== "string" || !r.benchmarkId.trim()) e.push("benchmarkId must be non-empty");
  if (!domains.has(r.domain)) e.push("invalid domain");
  if (typeof r.commit !== "string" || r.commit.length < 7) e.push("commit must contain at least 7 characters");
  if (!r.environment || typeof r.environment.os !== "string" || typeof r.environment.architecture !== "string") e.push("environment.os and environment.architecture are required");
  if (!statuses.has(r.status)) e.push("invalid overall status");
  if (typeof r.timestamp !== "string" || Number.isNaN(Date.parse(r.timestamp))) e.push("timestamp must be a parseable date-time");
  if (!Array.isArray(r.metrics)) e.push("metrics must be an array");
  else r.metrics.forEach((m,i) => {
    if (!m || typeof m.name !== "string" || !m.name.trim()) e.push(`metrics[${i}].name required`);
    if (typeof m.value !== "number" || !Number.isFinite(m.value)) e.push(`metrics[${i}].value must be finite`);
    if (typeof m.unit !== "string" || !m.unit.trim()) e.push(`metrics[${i}].unit required`);
    if (m.baseline !== undefined && (typeof m.baseline !== "number" || !Number.isFinite(m.baseline))) e.push(`metrics[${i}].baseline must be finite`);
    if (m.maxRegressionPercent !== undefined && (typeof m.maxRegressionPercent !== "number" || m.maxRegressionPercent < 0)) e.push(`metrics[${i}].maxRegressionPercent must be non-negative`);
  });
  if (!Array.isArray(r.checks)) e.push("checks must be an array");
  else r.checks.forEach((c,i) => { if (!c || typeof c.name !== "string" || !statuses.has(c.status)) e.push(`checks[${i}] requires name and valid status`); });
  if (r.artifacts !== undefined && (!Array.isArray(r.artifacts) || r.artifacts.some(a => typeof a !== "string"))) e.push("artifacts must be strings");
  return e;
}
function gate(r, fallback) {
  const e = [];
  if (r.status !== "PASS") e.push(`overall status is ${r.status}`);
  for (const c of r.checks) if (c.status !== "PASS") e.push(`check "${c.name}" is ${c.status}`);
  for (const m of r.metrics) {
    if (m.baseline === undefined) continue;
    const limit = m.maxRegressionPercent ?? fallback;
    if (limit === undefined || m.baseline === 0) continue;
    const regression = m.lowerIsBetter === false
      ? ((m.baseline - m.value) / Math.abs(m.baseline)) * 100
      : ((m.value - m.baseline) / Math.abs(m.baseline)) * 100;
    if (regression > limit) e.push(`metric "${m.name}" regressed ${regression.toFixed(2)}% (limit ${limit}%)`);
  }
  return e;
}
const [mode,file,...opts] = process.argv.slice(2);
if (!["validate","gate"].includes(mode) || !file) { console.error(usage); process.exit(2); }
let fallback;
for (const opt of opts) {
  const m = opt.match(/^--max-regression-percent=(\d+(?:\.\d+)?)$/);
  if (!m) { console.error(`Unknown option: ${opt}\n${usage}`); process.exit(2); }
  fallback = Number(m[1]);
}
try {
  const r = JSON.parse(await readFile(resolve(file),"utf8"));
  const errors = validate(r);
  if (errors.length) { errors.forEach(e => console.error(`INVALID: ${e}`)); process.exit(1); }
  console.log("PASS: benchmark result structure is valid");
  if (mode === "gate") {
    const failures = gate(r,fallback);
    if (failures.length) { failures.forEach(e => console.error(`GATE: ${e}`)); process.exitCode = 1; }
    else console.log("PASS: correctness and configured regression checks passed");
  }
} catch (e) { console.error(`FAIL: cannot read or parse result: ${e.message}`); process.exitCode = 1; }
