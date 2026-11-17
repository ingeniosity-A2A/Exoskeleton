#!/usr/bin/env -S npx tsx
/**
 * workorder.ts: one-sheet runner for the "service repairman" delegate model.
 *
 *   main agent / you  --add-->  DuckDB ledger  --run-->  delegate (one CLI, one session)
 *                                   ^                          |
 *                                   +------ report + follow-up order <-----+
 *
 * Setup:   pnpm add @duckdb/node-api && pnpm add -D tsx typescript @types/node
 * Needs:   `claude` (Claude Code), `gh`, `tailscale` on PATH and already authenticated.
 *
 * Usage:
 *   tsx workorder.ts add gh        read   "what changed in ingeniosity-A2A/Exoskeleton since the last tag"
 *   tsx workorder.ts add tailscale read   "node hd-edge-01 is unreachable, diagnose"
 *   tsx workorder.ts add tailscale change "enable --accept-routes on this node" --depends <orderId>
 *   tsx workorder.ts run                  # runs every ready order, then exits
 *   tsx workorder.ts approve <orderId>    # releases an order held for a decision
 *   tsx workorder.ts status               # orders + latest reports
 *
 * Rules baked in:
 *   - A delegate is one headless session limited to ONE CLI by an allowlist. Session ends with the report.
 *   - read orders run automatically. change orders are held as needs_decision until `approve`.
 *   - Connectivity-breaking commands (tailscale up/down/logout, ACL edits) are not in any allowlist.
 *     They can only come back as a proposal in the report.
 *   - Reports are written to DuckDB. A failed report may create ONE follow-up order, depth-capped.
 *
 * Checked against the real tools before relying on it (2026-11-17):
 *   - claude 2.1.316: --allowedTools is `<tools...>` (each rule its own argv entry; the help
 *     text also accepts a comma- or space-separated single value), --output-format json emits
 *     {result, session_id, total_cost_usd, is_error, subtype}, --max-turns is print-mode only.
 *     A delegate run that cannot authenticate still exits 0 with is_error: true, so is_error
 *     and subtype are checked instead of the exit code alone.
 *   - @duckdb/node-api 2.0.0-r.1: DuckDBInstance.create(path), instance.connect(),
 *     run(sql, values) with `?` positional binding, runAndReadAll(...).getRowObjectsJson().
 *   - Top-level `await` is not available in a .ts file under tsx unless the package is ESM,
 *     so the open/CLI path runs inside main(); this keeps the file usable from a CJS package.
 *   - Not exercised: the delegate sessions themselves (no authenticated `claude`, `gh` or
 *     `tailscale` on the machine that checked this), and permission handling for calls that
 *     are not on the allowlist. In print mode those are denied rather than prompted; older
 *     CLIs may instead wait, in which case add `--permission-prompts none` (v2.1.259+).
 */
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

// ---------- config ----------
const DB_PATH = process.env.WO_DB ?? "workorders.duckdb";
const MAX_TURNS = process.env.WO_MAX_TURNS ?? "12";
const TIMEOUT_MS = Number(process.env.WO_TIMEOUT_MS ?? 180_000);
const MAX_DEPTH = 2; // follow-up chain cap

type Delegate = "gh" | "tailscale";
type Mode = "read" | "change";

// Allowlists ARE the permission layer. Keep them narrow.
const ALLOW: Record<Delegate, Record<Mode, string[]>> = {
  gh: {
    read: [
      "Bash(gh repo view:*)", "Bash(gh repo list:*)",
      "Bash(gh release list:*)", "Bash(gh release view:*)",
      "Bash(gh issue list:*)", "Bash(gh issue view:*)",
      "Bash(gh search:*)",
      // gh api is GET by default but takes -X POST/-X DELETE, so only the explicit GET form is read-only.
      "Bash(gh api -X GET:*)",
    ],
    change: [
      "Bash(gh repo view:*)", "Bash(gh release list:*)", "Bash(gh release view:*)",
      "Bash(gh issue list:*)", "Bash(gh issue view:*)",
      "Bash(gh issue create:*)", "Bash(gh issue comment:*)", "Bash(gh issue close:*)",
      "Bash(gh release create:*)",
    ],
  },
  tailscale: {
    read: [
      "Bash(tailscale status:*)", "Bash(tailscale netcheck:*)", "Bash(tailscale ping:*)",
      "Bash(tailscale ip:*)", "Bash(tailscale whois:*)", "Bash(tailscale version:*)",
      "Bash(tailscale bugreport:*)", "Bash(tailscale dns status:*)",
    ],
    // No up / down / logout / ACL. `set` flags are reversible by running `set` again.
    change: [
      "Bash(tailscale status:*)", "Bash(tailscale netcheck:*)", "Bash(tailscale ping:*)",
      "Bash(tailscale set:*)",
    ],
  },
};

// ---------- ledger ----------
let db: DuckDBConnection;

async function openLedger() {
  db = await (await DuckDBInstance.create(DB_PATH)).connect();
  await db.run(`
  CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR PRIMARY KEY, delegate VARCHAR, mode VARCHAR, intent VARCHAR,
    depends_on VARCHAR,            -- JSON array of order ids
    status VARCHAR,                -- pending | needs_decision | running | done | failed
    depth INTEGER, parent VARCHAR, created_at TIMESTAMP DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS reports (
    order_id VARCHAR, verdict VARCHAR, summary VARCHAR, evidence VARCHAR,
    changes VARCHAR, undo VARCHAR, proposal VARCHAR, raw VARCHAR,
    session_id VARCHAR, cost_usd DOUBLE, created_at TIMESTAMP DEFAULT now()
  );
`);
}

const rows = async (sql: string, params: unknown[] = []) =>
  (await db.runAndReadAll(sql, params as any)).getRowObjectsJson() as Record<string, any>[];

async function addOrder(
  delegate: Delegate, mode: Mode, intent: string,
  dependsOn: string[] = [], depth = 0, parent: string | null = null,
) {
  const id = randomUUID().slice(0, 8);
  const status = mode === "change" ? "needs_decision" : "pending";
  await db.run(
    `INSERT INTO orders (id, delegate, mode, intent, depends_on, status, depth, parent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, delegate, mode, intent, JSON.stringify(dependsOn), status, depth, parent] as any,
  );
  return id;
}

// ---------- delegate ----------
type Report = {
  verdict: "fixed" | "not_fixed" | "needs_decision" | "answered";
  summary: string; evidence?: string; changes?: string[]; undo?: string[];
  proposal?: string;
  followup?: { delegate: Delegate; mode: Mode; intent: string };
};

function workOrderPrompt(o: Record<string, any>) {
  const cli = o.delegate as Delegate;
  return [
    `You are a service technician for the \`${cli}\` CLI. You have ONE work order. Complete it, then stop.`,
    `Work order: ${o.intent}`,
    `Mode: ${o.mode}. ${o.mode === "read"
      ? "Read-only. Do not change any state."
      : "You may change state, but only with the commands you are permitted. Record the exact undo for every change."}`,
    `Use the CLI's own help and output as the authority. Do not guess beyond what the CLI reports.`,
    `If a fix would need a command you cannot run (taking the node down, ACL edits, anything that could cut your own connection), do NOT attempt it. Put it in "proposal" and set verdict to "needs_decision".`,
    `Finish with ONLY one JSON object, no prose, shaped exactly:`,
    `{"verdict":"fixed|not_fixed|needs_decision|answered","summary":"<=3 sentences","evidence":"key trimmed command output","changes":["..."],"undo":["..."],"proposal":"optional","followup":{"delegate":"gh|tailscale","mode":"read|change","intent":"..."}}`,
    `"followup" is optional: include it only if one more concrete work order would resolve a not_fixed result.`,
  ].join("\n");
}

function runClaude(prompt: string, allowed: string[]) {
  return new Promise<{ result: string; session_id?: string; total_cost_usd?: number }>((resolve, reject) => {
    const args = [
      "-p", prompt,
      "--allowedTools", ...allowed,
      "--output-format", "json",
      "--max-turns", MAX_TURNS,
    ];
    const p = spawn("claude", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const t = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("delegate timeout")); }, TIMEOUT_MS);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      clearTimeout(t);
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${err.slice(0, 500)}`));
      try { resolve(JSON.parse(out)); } catch { reject(new Error("unparseable claude output")); }
    });
  });
}

function extractReport(text: string): Report | null {
  const end = text.lastIndexOf("}");
  for (let start = text.indexOf("{"); start !== -1 && start < end; start = text.indexOf("{", start + 1)) {
    try {
      const r = JSON.parse(text.slice(start, end + 1));
      if (r && typeof r.verdict === "string") return r as Report;
    } catch { /* keep scanning */ }
  }
  return null;
}

// ---------- scheduler ----------
async function runReady() {
  let ran = 0;
  for (;;) {
    const pending = await rows(`SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at`);
    let next: Record<string, any> | undefined;
    for (const o of pending) {
      const deps: string[] = JSON.parse(o.depends_on);
      if (!deps.length) { next = o; break; }
      const st = await rows(`SELECT id, status FROM orders WHERE id IN (${deps.map(() => "?").join(",")})`, deps);
      if (st.length === deps.length && st.every((d) => d.status === "done")) { next = o; break; }
      if (st.some((d) => d.status === "failed")) {
        await db.run(`UPDATE orders SET status = 'failed' WHERE id = ?`, [o.id] as any);
      }
    }
    if (!next) break;

    await db.run(`UPDATE orders SET status = 'running' WHERE id = ?`, [next.id] as any);
    console.log(`[${next.id}] ${next.delegate}/${next.mode}: ${next.intent}`);

    let report: Report | null = null, raw = "", sid: string | undefined, cost: number | undefined;
    try {
      const res: any = await runClaude(workOrderPrompt(next), ALLOW[next.delegate as Delegate][next.mode as Mode]);
      if (res.is_error || res.subtype !== "success")
        throw new Error(`claude reported ${res.subtype ?? "error"}: ${String(res.result ?? "").slice(0, 300)}`);
      raw = res.result ?? ""; sid = res.session_id; cost = res.total_cost_usd;
      report = extractReport(raw);
    } catch (e) {
      raw = String(e);
    }

    const ok = !!report && report.verdict !== "not_fixed";
    await db.run(
      `INSERT INTO reports (order_id, verdict, summary, evidence, changes, undo, proposal, raw, session_id, cost_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        next.id, report?.verdict ?? "failed", report?.summary ?? raw.slice(0, 400),
        report?.evidence ?? "", JSON.stringify(report?.changes ?? []), JSON.stringify(report?.undo ?? []),
        report?.proposal ?? "", raw, sid ?? "", cost ?? 0,
      ] as any,
    );
    await db.run(`UPDATE orders SET status = ? WHERE id = ?`, [ok ? "done" : "failed", next.id] as any);
    ran++;

    // A failed result may spawn one bounded follow-up; change orders still wait for approval.
    const f = report?.followup;
    if (f && !ok && next.depth < MAX_DEPTH && (f.delegate === "gh" || f.delegate === "tailscale")) {
      const fid = await addOrder(f.delegate, f.mode === "change" ? "change" : "read", f.intent, [], next.depth + 1, next.id);
      console.log(`  follow-up ${fid} created from ${next.id}`);
    }
    console.log(`  -> ${report?.verdict ?? "failed"}: ${report?.summary ?? raw.slice(0, 120)}`);
  }

  const held = await rows(`SELECT id, delegate, intent FROM orders WHERE status = 'needs_decision'`);
  for (const h of held) console.log(`HELD [${h.id}] ${h.delegate}: ${h.intent}  (tsx workorder.ts approve ${h.id})`);
  console.log(`done. ${ran} order(s) run, ${held.length} held.`);
}

// ---------- cli ----------
async function main() {
  await openLedger();

  const [cmd, ...a] = process.argv.slice(2);

  if (cmd === "add") {
    const [delegate, mode, intent] = a;
    if (!["gh", "tailscale"].includes(delegate) || !["read", "change"].includes(mode) || !intent)
      throw new Error(`usage: add <gh|tailscale> <read|change> "<intent>" [--depends id,id]`);
    const di = a.indexOf("--depends");
    const deps = di >= 0 ? a[di + 1].split(",") : [];
    console.log(await addOrder(delegate as Delegate, mode as Mode, intent, deps));
  } else if (cmd === "run") {
    await runReady();
  } else if (cmd === "approve") {
    const r: any = await db.run(`UPDATE orders SET status = 'pending' WHERE id = ? AND status = 'needs_decision'`, [a[0]] as any);
    console.log(`released ${r.rowsChanged ?? 0} order(s); run again to execute`);
  } else if (cmd === "status") {
    console.table(await rows(`
    SELECT o.id, o.delegate, o.mode, o.status, o.intent, r.verdict, r.summary
    FROM orders o LEFT JOIN reports r ON r.order_id = o.id ORDER BY o.created_at`));
  } else {
    console.log("commands: add | run | approve <id> | status");
  }
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
