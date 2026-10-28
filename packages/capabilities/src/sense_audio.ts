/**
 * Headless sensory capability: sense.audio
 *
 * Singular composed capability. Tools/skills behind it (ASR, TTS, audio
 * understand, speech-to-speech) are implementation detail.
 *
 * Backend candidate (not required at register time):
 *   nvidia/Nemotron-Labs-Audex-2B | 30B-A3B
 *   https://huggingface.co/collections/nvidia/nemotron-labs-audex
 *
 * Manifesto fit: capability layer only — never substrate.
 */

import type {
  CapabilityHandler,
  CapabilityObservation,
  CapabilityRequest,
} from './types';

export type SenseAudioMode =
  | 'understand'
  | 'transcribe'
  | 'speak'
  | 'generate'
  | 'dialog';

export interface SenseAudioInput {
  mode: SenseAudioMode;
  /** Text prompt or instruction */
  text?: string;
  /** Base64 or URI audio — opaque to the model contract */
  audioRef?: string;
  language?: string;
}

/**
 * Pluggable backend. Swap Audex / Dynamo speech / local mock without
 * changing the capability name the model calls.
 */
export interface AudioSenseBackend {
  id: string;
  run(input: SenseAudioInput): Promise<Record<string, unknown>>;
}

/** Deterministic offline backend for tests and cold start */
export const mockAudioBackend: AudioSenseBackend = {
  id: 'mock',
  async run(input) {
    return {
      mode: input.mode,
      text: input.text ?? '',
      transcript: input.mode === 'transcribe' ? '[mock transcript]' : undefined,
      audioOutRef: input.mode === 'speak' || input.mode === 'generate' ? 'mock://audio/out' : undefined,
      note: 'mock backend — replace with Audex or Dynamo /v1/audio/speech',
    };
  },
};

export function createSenseAudioCapability(
  backend: AudioSenseBackend = mockAudioBackend,
): CapabilityHandler {
  return {
    name: 'sense.audio',
    kind: 'sensory',
    description:
      'Unified audio sense: understand, transcribe, speak, generate, dialog. Single observation surface.',
    async invoke(req: CapabilityRequest): Promise<CapabilityObservation> {
      const t0 = performance.now();
      const input = req.input as unknown as SenseAudioInput;
      if (!input?.mode) {
        return {
          ok: false,
          capability: 'sense.audio',
          data: {},
          error: 'input.mode required',
          latencyMs: performance.now() - t0,
        };
      }
      const data = await backend.run(input);
      // Strip backend identity from observation
      const { note: _n, ...publicData } = data as Record<string, unknown> & { note?: string };
      return {
        ok: true,
        capability: 'sense.audio',
        data: publicData,
        latencyMs: performance.now() - t0,
      };
    },
  };
}
