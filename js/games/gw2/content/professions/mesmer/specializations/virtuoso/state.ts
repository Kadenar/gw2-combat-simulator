import type { MesmerConfig } from '#gw2/content/professions/mesmer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { MesmerVirtuosoState } from '#gw2/content/professions/mesmer/specializations/virtuoso/types.js';

export function createVirtuosoState(config: Partial<MesmerConfig> = {}): MesmerVirtuosoState {
  return {
    numericResource: 0,
    nextForgeAt: config.infiniteForge ? 3 : Infinity,
    bloodsongProgress: 0
  };
}

export function createVirtuosoResolverState(): Record<string, never> {
  return {};
}

export const virtuosoState = defineProfessionSpecializationState('Virtuoso', createVirtuosoState);
