export * from './types';
export * from './registry';
export * from './sense_audio';
export * from './compose_harness';

import { globalCapabilityRegistry } from './registry';
import { createSenseAudioCapability, mockAudioBackend } from './sense_audio';
import { codeResolveExample } from './compose_harness';

/** Default headless sensory + reference composed harness registration */
export function registerDefaultCapabilities(): void {
  globalCapabilityRegistry.register(createSenseAudioCapability(mockAudioBackend));
  globalCapabilityRegistry.register(codeResolveExample);
}
