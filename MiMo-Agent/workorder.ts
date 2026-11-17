#!/usr/bin/env -S npx tsx
/**
 * workorder.ts: one-sheet runner for the "service repairman" delegate model.
 *
 *   main agent / you  --add-->  DuckDB ledger  --run-->  delegate (one model session, one CLI)
 *                                   ^                          |
 *                                   +------ report + follow-up order <-----+
 *
 * Setup:   pnpm add @duckdb/node-api && pnpm add -D tsx typescript @types/node
 * Needs:   OPENROUTER_API in the environment, and `gh` / `tailscale` on PATH.
 *          The model defaults to xiaomi/mimo-v2.6-pro; override with WO_MODEL.
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
 *   - The model is MiMo. It has exactly one tool, run_cli, and this runner enforces the
 *     allowlist — no other agent harness and no shell is involved.
 *   - Commands are tokenised and spawned without a shell, so `;`, `&&`, pipes, redirects,
 *     `$(...)` and backticks are inert rather than merely discouraged.
 *   - read orders run automatically. change orders are held as needs_decision until `approve`.
 *   - Connectivity-breaking commands (tailscale up/down/logout, ACL edits) are in no allowlist.
 *     They can only come back as a proposal in the report.
 *   - Reports are written to DuckDB. A failed report may create ONE follow-up order, depth-capped.
 *
 * Checked against the real tools before relying on it (2026-11-17):
 *   - OpenRouter advertises tools and tool_choice for xiaomi/mimo-v2.5, -v2.6-flash,
 *     -v2.6-pro and -v2.6-pro-ultraspeed. A live call to xiaomi/mimo-v2.6-pro returned
 *     finish_reason "tool_calls" with {"command":"gh --version"} for $0.0000835.
 *   - @duckdb/node-api 2.0.0-r.1: DuckDBInstance.create(path), instance.connect(),
 *     run(sql, values) with `?` positional binding, runAndReadAll(...).getRowObjectsJson().
 *   - Top-level `await` is not available in a .ts file under tsx unless the package is ESM,
 *     so the open/CLI path runs inside main(); this keeps the file usable from a CJS package.
 *   - Live sessions on this host: `gh auth status` and `gh --version` ran through run_cli and the
 *     report answered from their real output; a run_cli call for `ls /tmp` was refused by this
 *     runner and the technician reported the refusal instead of the listing; `gh --version;
 *     rm -rf <file>` executed only the allowed half and left the file in place. Observed cost
 *     per order: $0.0005 to $0.0011 on xiaomi/mimo-v2.6-pro.
 *   - Not exercised: a tailscale delegate, a change order actually executed, and the follow-up
 *     spawn path (answered and needs_decision both count as a successful order).
 */
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

// ---------- config ----------
const DB_PATH = process.env.WO_DB ?? "workorders.duckdb";
const MODEL = process.env.WO_MODEL ?? "xiaomi/mimo-v2.6-pro";
const API_BASE = process.env.WO_API_BASE ?? "https://openrouter.ai/api/v1";
const API_KEY = process.env.OPENROUTER_API ?? process.env.OPENROUTER_API_KEY ?? "";
const MAX_TURNS = Number(process.env.WO_MAX_TURNS ?? 8);        // tool-calling rounds
const TIMEOUT_MS = Number(process.env.WO_TIMEOUT_MS ?? 60_000); // per command
const MAX_DEPTH = 2; // follow-up chain cap
const OUTPUT_LIMIT = 4000; // characters fed back to the model per command

type Delegate = "gh" | "tailscale";
type Mode = "read" | "change";

// Allowlists ARE the permission layer. Each rule is a token prefix; a trailing `*`
// allows further arguments, and a rule without one must match the whole command.
const ALLOW: Record<Delegate, Record<Mode, string[]>> = {
  gh: {
    read: [
      "gh repo view *", "gh repo list *",
      "gh release list *", "gh release view *",
      "gh issue list *", "gh issue view *",
      "gh search *",
      // Exact rules: `gh auth status --show-token` would print the token into the ledger.
      "gh --version", "gh auth status",
      // gh api takes -X POST/-X DELETE, so read mode only allows the explicit GET form.
      "gh api -X GET *",
    ],
    change: [
      "gh repo view *", "gh release list *", "gh release view *",
      "gh issue list *", "gh issue view *",
      "gh issue create *", "gh issue comment *", "gh issue close *",
      "gh release create *", "gh api *",
    ],
  },
  tailscale: {
    read: [
      "tailscale status *", "tailscale netcheck *", "tailscale ping *",
      "tailscale ip *", "tailscale whois *", "tailscale version *",
      "tailscale bugreport *", "tailscale dns status *",
    ],
    // No up / down / logout / ACL. `set` flags are reversible by running `set` again.
    change: [
      "tailscale status *", "tailscale netcheck *", "tailscale ping *",
      "tailscale set *",
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

// ---------- allowlist ----------
// No shell is used, so quoting is the only thing the tokeniser has to understand.
function tokenise(command: string): string[] {
  const out: string[] = [];
  let cur = "", quote: "'" | '"' | null = null;
  for (const ch of command.trim()) {
    if (quote) {
      if (ch === quote) quote = null; else cur += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (cur) { out.push(cur); cur = ""; }
    } else {
      cur += ch;
    }
  }
  if (quote) throw new Error(`unbalanced quote in command: ${command}`);
  if (cur) out.push(cur);
  return out;
}

function isAllowed(tokens: string[], rules: string[]): boolean {
  return rules.some((rule) => {
    const parts = rule.split(" ");
    const prefix = parts[parts.length - 1] === "*" ? parts.slice(0, -1) : parts;
    const exact = parts[parts.length - 1] !== "*";
    if (exact && tokens.length !== prefix.length) return false;
    return prefix.every((t, i) => tokens[i] === t);
  });
}

async function runCli(tokens: string[]): Promise<string> {
  const [program, ...args] = tokens;
  return new Promise((resolve) => {
    const child = spawn(program, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("error", (e) => { clearTimeout(timer); resolve(`spawn failed: ${String(e.message)}`); });
    child.on("close", (code) => {
      clearTimeout(timer);
      const body = out.length > OUTPUT_LIMIT ? `${out.slice(0, OUTPUT_LIMIT)}\n[truncated]` : out;
      resolve(`exit ${code}\n${body}`);
    });
  });
}

// ---------- delegate ----------
type Report = {
  verdict: "fixed" | "not_fixed" | "needs_decision" | "answered";
  summary: string; evidence?: string; changes?: string[]; undo?: string[];
  proposal?: string;
  followup?: { delegate: Delegate; mode: Mode; intent: string };
};

type ToolCall = { id: string; function: { name: string; arguments: string } };
type Message = Record<string, any>;

const TOOL = [{
  type: "function",
  function: {
    name: "run_cli",
    description: "Run one command from the allowlist on this host and return its output.",
    parameters: {
      type: "object",
      properties: { command: { type: "string", description: "the command line, e.g. gh auth status" } },
      required: ["command"],
    },
  },
}];

function workOrderPrompt(o: Record<string, any>) {
  const cli = o.delegate as Delegate;
  return [
    `You are a service technician for the \`${cli}\` CLI. You have ONE work order. Complete it, then stop.`,
    `Work order: ${o.intent}`,
    `Mode: ${o.mode}. ${o.mode === "read"
      ? "Read-only. Do not change any state."
      : "You may change state, but only with the commands you are permitted. Record the exact undo for every change."}`,
    `Your only tool is run_cli. It runs a single command on this host. A command outside the allowlist is refused and nothing is executed; do not try to work around a refusal.`,
    `Use the CLI's own help and output as the authority. Do not guess beyond what the CLI reports.`,
    `If a fix would need a command you cannot run (taking the node down, ACL edits, anything that could cut your own connection), do NOT attempt it. Put it in "proposal" and set verdict to "needs_decision".`,
    `Finish with ONLY one JSON object, no prose, shaped exactly:`,
    `{"verdict":"fixed|not_fixed|needs_decision|answered","summary":"<=3 sentences","evidence":"key trimmed command output","changes":["..."],"undo":["..."],"proposal":"optional","followup":{"delegate":"gh|tailscale","mode":"read|change","intent":"..."}}`,
    `"followup" is optional: include it only if one more concrete work order would resolve a not_fixed result.`,
  ].join("\n");
}

async function chat(messages: Message[]): Promise<{ message: Message; cost: number; id?: string }> {
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, tools: TOOL, tool_choice: "auto" }),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`model http ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  const choice = body.choices?.[0];
  if (!choice) throw new Error(`model returned no choice: ${JSON.stringify(body).slice(0, 300)}`);
  return { message: choice.message ?? {}, cost: body.usage?.cost ?? 0, id: body.id };
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

async function delegate(o: Record<string, any>) {
  if (!API_KEY) throw new Error("OPENROUTER_API is not set");
  const rules = ALLOW[o.delegate as Delegate][o.mode as Mode];
  const messages: Message[] = [
    { role: "system", content: workOrderPrompt(o) },
    { role: "user", content: `Work order ${o.id}: ${o.intent}` },
  ];

  let cost = 0, transcript = "", sessionId: string | undefined;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const { message, cost: c, id } = await chat(messages);
    cost += c; sessionId = id ?? sessionId;
    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });

    const calls: ToolCall[] = message.tool_calls ?? [];
    if (!calls.length) {
      transcript = String(message.content ?? "");
      return { report: extractReport(transcript), raw: transcript, cost, sessionId };
    }

    for (const call of calls) {
      let result: string;
      try {
        const args = JSON.parse(call.function?.arguments ?? "{}");
        const command = String(args.command ?? "").trim();
        const tokens = tokenise(command);
        if (!tokens.length) {
          result = "refused: empty command";
        } else if (!isAllowed(tokens, rules)) {
          result = `refused: \`${command}\` is not on the ${o.delegate} ${o.mode} allowlist. Allowed: ${rules.join(" | ")}`;
        } else {
          result = await runCli(tokens);
        }
        transcript += `$ ${command}\n${result}\n`;
      } catch (e) {
        result = `error: ${String((e as Error).message ?? e)}`;
        transcript += `${result}\n`;
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }

  return { report: extractReport(transcript), raw: transcript || "turn limit reached with no report", cost, sessionId };
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

    let report: Report | null = null, raw = "", sid: string | undefined, cost = 0;
    try {
      const r = await delegate(next);
      report = r.report; raw = r.raw; sid = r.sessionId; cost = r.cost;
    } catch (e) {
      raw = String((e as Error).message ?? e);
    }

    const ok = !!report && report.verdict !== "not_fixed";
    await db.run(
      `INSERT INTO reports (order_id, verdict, summary, evidence, changes, undo, proposal, raw, session_id, cost_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        next.id, report?.verdict ?? "failed", report?.summary ?? raw.slice(0, 400),
        report?.evidence ?? "", JSON.stringify(report?.changes ?? []), JSON.stringify(report?.undo ?? []),
        report?.proposal ?? "", raw, sid ?? "", cost,
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
    console.log(`  -> ${report?.verdict ?? "failed"}: ${report?.summary ?? raw.slice(0, 120)} ($${cost.toFixed(5)})`);
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
    const [delegateName, mode, intent] = a;
    if (!["gh", "tailscale"].includes(delegateName) || !["read", "change"].includes(mode) || !intent)
      throw new Error(`usage: add <gh|tailscale> <read|change> "<intent>" [--depends id,id]`);
    const di = a.indexOf("--depends");
    const deps = di >= 0 ? a[di + 1].split(",") : [];
    console.log(await addOrder(delegateName as Delegate, mode as Mode, intent, deps));
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
