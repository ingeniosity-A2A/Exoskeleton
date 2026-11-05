export * from './types.js';
export * from './registry.js';
export * from './sense_audio.js';
export * from './compose_harness.js';
export * from './events.js';
export * from './lifecycle.js';

import { globalCapabilityRegistry } from './registry.js';
import { createSenseAudioCapability, mockAudioBackend } from './sense_audio.js';
import { codeResolveExample } from './compose_harness.js';

/** Default headless sensory + reference composed harness registration */
export function registerDefaultCapabilities(): void {
  globalCapabilityRegistry.register(createSenseAudioCapability(mockAudioBackend));
  globalCapabilityRegistry.register(codeResolveExample);
}
