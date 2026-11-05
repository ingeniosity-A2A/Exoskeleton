/**
 * Minimal ambient declarations for the Node built-ins the durable telemetry
 * sink uses.
 *
 * The workspace pins only `typescript` and no `@types/node`; adding a
 * devDependency would force a pnpm lockfile change. These declarations cover
 * exactly the calls made by `durable_sink.ts` and nothing more.
 */

declare module 'node:fs' {
  export function mkdirSync(path: string, options: { recursive: boolean }): void;
  export function openSync(path: string, flags: string): number;
  export function writeSync(fd: number, data: string): number;
  export function fsyncSync(fd: number): void;
  export function closeSync(fd: number): void;
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: 'utf8'): string;
}

declare module 'node:path' {
  export function dirname(path: string): string;
}
