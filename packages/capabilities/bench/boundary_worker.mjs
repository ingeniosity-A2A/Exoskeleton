/**
 * Worker used by the copy-boundary measurements.
 *
 * It reports what it actually observed — byte length, a digest of the bytes it
 * read, and a mutation it applied — so the main thread can distinguish a real
 * shared allocation from a copy instead of trusting the transfer API.
 */
import { createHash } from 'node:crypto';
import { parentPort } from 'node:worker_threads';

const digest = (view) => createHash('sha256').update(view).digest('hex').slice(0, 16);

parentPort.on('message', (message) => {
  if (message.type === 'clone' || message.type === 'transfer') {
    const view = new Uint8Array(message.buffer);
    const before = digest(view);
    const firstByte = view[0];
    // Mutate, so the main thread can prove whether it shares this memory.
    view[0] = (view[0] + 1) & 0xff;
    parentPort.postMessage({
      type: message.type,
      byteLength: view.byteLength,
      digest: before,
      firstByteSeen: firstByte,
      firstByteWritten: view[0],
    });
    return;
  }

  if (message.type === 'shared') {
    const view = new Uint8Array(message.buffer);
    const counter = new Int32Array(message.counter);
    const before = counter[0];
    // Read a byte the main thread wrote, then write one for it to read back.
    const observedByte = view[0];
    view[1] = 0x5a;
    Atomics.store(counter, 1, observedByte);
    Atomics.add(counter, 0, 1);
    Atomics.notify(counter, 0);
    parentPort.postMessage({ type: 'shared', byteLength: view.byteLength, counterBefore: before, observedByte });
    return;
  }

  parentPort.postMessage({ type: 'error', error: `unknown message: ${String(message.type)}` });
});
