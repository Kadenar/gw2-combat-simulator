import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import { selectedRangerPet } from '#gw2/professions/ranger/core/state.js';
import type { RangerConfig, RangerState } from '#gw2/professions/ranger/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

export interface SoulbeastState {
  pendingSharedStances: Gw2ResolverEvent[];
  beastmodeActive: boolean;
  archetype: string;
  oneWolfPackUntil: number;

  beastAbilityActivations: Record<string, boolean>;
}

// Soulbeast owns its public Beastmode and stance projection.
export const SOULBEAST_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  beastmodeActive: false,
  archetype: '',
  oneWolfPackUntil: 0
} satisfies Partial<RangerState>);

export function createSoulbeastState(config: RangerConfig = {}): SoulbeastState {
  const pet = selectedRangerPet(config);
  return {
    pendingSharedStances: [],
    // Soulbeast starts merged — the rotation begins in Beastmode by default.
    beastmodeActive: true,
    archetype: pet?.archetype || '',
    oneWolfPackUntil: 0,

    // Tracks per-activation-id whether the beast-ability first-hit proc already fired, preventing multi-hit skills from triggering trait effects more than once per cast.
    beastAbilityActivations: {}
  };
}

export const soulbeastState = defineProfessionSpecializationState('Soulbeast', createSoulbeastState);
