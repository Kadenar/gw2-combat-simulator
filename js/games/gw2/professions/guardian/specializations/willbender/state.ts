import type { RefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import {
  defineProfessionSpecializationState,
  definePublicStateDefaults
} from '#gw2/platform/profession-definition/state.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { GuardianVirtue } from '#gw2/professions/guardian/types.js';

export interface GuardianWillbenderState {
  flameVirtue: GuardianVirtue | null;
  flameGeneration: number;
  weaponCastRecharge: Record<string, { skillId: SkillId; rechargeStart: number; rechargeWork: number }>;
  pendingWeaponCooldownReduction: Record<string, number>;
  justiceUntil: number;
  resolveUntil: number;
  courageUntil: number;
  virtueHitCounts: Record<'justice' | 'resolve' | 'courage', number>;
  lethalTempo: RefreshedStacks;
  triggeredVirtueEffects: number;
}

function createWillbenderState(): GuardianWillbenderState {
  return {
    flameVirtue: null,
    flameGeneration: 0,
    weaponCastRecharge: {},
    pendingWeaponCooldownReduction: {}, // keyed by reservationId; accumulates in-flight reductions and cleared on cast-complete
    justiceUntil: 0,
    resolveUntil: 0,
    courageUntil: 0,
    virtueHitCounts: {
      justice: 0,
      resolve: 0,
      courage: 0
    },
    lethalTempo: { stacks: 0, expiresAt: 0 },
    triggeredVirtueEffects: 0
  };
}

/** Keeps Willbender projection ownership beside the state that produces it. */
export const WILLBENDER_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  flameVirtue: null,
  justiceUntil: 0,
  resolveUntil: 0,
  courageUntil: 0,
  virtueHitCounts: { justice: 0, resolve: 0, courage: 0 },
  lethalTempo: { stacks: 0, expiresAt: 0 },
  triggeredVirtueEffects: 0
} satisfies Partial<GuardianWillbenderState>);

export const willbenderState = defineProfessionSpecializationState('Willbender', createWillbenderState);
