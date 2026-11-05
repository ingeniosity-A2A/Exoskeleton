/**
 * Durable lifecycle telemetry: append-only NDJSON with explicit fsync, plus a
 * replay validator used for restart recovery.
 *
 * Scope of the claim: an event is durable once `flush()` returns, because
 * `fsyncSync` has been called on the file descriptor. There is no delivery
 * guarantee to any remote collector, and no remote exporter is provisioned.
 *
 * This module is deliberately not re-exported from `index.ts`: it is the only
 * file in the package that touches the filesystem, and importing the package
 * must not pull Node built-ins into every consumer.
 */

import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';

import type { EventSink, LifecycleEvent } from './events.js';
import { LIFECYCLE_EVENT_SCHEMA } from './events.js';

export interface FlushReport {
  events: number;
  bytes: number;
}

export interface ReplayReport {
  path: string;
  expected_schema: typeof LIFECYCLE_EVENT_SCHEMA;
  events: number;
  traces: number;
  duplicate_event_ids: number;
  seq_gaps: number;
  malformed_lines: number;
  capabilities: string[];
  ok: boolean;
}

/**
 * Appends one JSON object per line. `emit` writes immediately so a crash mid-run
 * loses at most the line being written; `flush` fsyncs and is the durability
 * boundary callers must honour.
 */
export class JsonlEventSink implements EventSink {
  private readonly fd: number;
  private pendingEvents = 0;
  private pendingBytes = 0;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.fd = openSync(path, 'a');
  }

  emit(event: LifecycleEvent): void {
    const line = `${JSON.stringify(event)}\n`;
    const written = writeSync(this.fd, line);
    this.pendingEvents += 1;
    this.pendingBytes += written;
  }

  flush(): FlushReport {
    fsyncSync(this.fd);
    const report = { events: this.pendingEvents, bytes: this.pendingBytes };
    this.pendingEvents = 0;
    this.pendingBytes = 0;
    return report;
  }

  close(): void {
    fsyncSync(this.fd);
    closeSync(this.fd);
  }
}

/**
 * Replay a telemetry file and report whether it is self-consistent: schema
 * match, no duplicate `eventId`, and contiguous per-trace `seq` after a restart.
 */
export function recoverJsonl(path: string): ReplayReport {
  const report: ReplayReport = {
    path,
    expected_schema: LIFECYCLE_EVENT_SCHEMA,
    events: 0,
    traces: 0,
    duplicate_event_ids: 0,
    seq_gaps: 0,
    malformed_lines: 0,
    capabilities: [],
    ok: false,
  };
  if (!existsSync(path)) return report;

  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0);
  const seenIds = new Set<string>();
  const lastSeq = new Map<string, number>();
  const capabilities = new Set<string>();

  for (const line of lines) {
    let event: LifecycleEvent;
    try {
      event = JSON.parse(line) as LifecycleEvent;
    } catch {
      report.malformed_lines += 1;
      continue;
    }
    if (event?.schema !== LIFECYCLE_EVENT_SCHEMA || typeof event.eventId !== 'string') {
      report.malformed_lines += 1;
      continue;
    }
    report.events += 1;
    if (seenIds.has(event.eventId)) report.duplicate_event_ids += 1;
    else seenIds.add(event.eventId);
    const previous = lastSeq.get(event.traceId) ?? 0;
    if (event.seq !== previous + 1) report.seq_gaps += 1;
    lastSeq.set(event.traceId, event.seq);
    capabilities.add(event.capability);
  }

  report.traces = lastSeq.size;
  report.capabilities = [...capabilities].sort();
  report.ok =
    report.events > 0 &&
    report.malformed_lines === 0 &&
    report.duplicate_event_ids === 0 &&
    report.seq_gaps === 0;
  return report;
}
