import type { RefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { GuardianVirtue } from '#gw2/professions/guardian/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

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
    lethalTempo: { stacks: 0, expiresAt: 0 }
  };
}

export const willbenderState = defineProfessionSpecializationState('Willbender', createWillbenderState);

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectWillbenderPlanningState(input: Gw2PlanningStateInput) {
  const state = willbenderState.from(input);
  return structuredClone({
    [STATE.FLAME_VIRTUE]: state.flameVirtue,
    [STATE.JUSTICE_UNTIL]: state.justiceUntil,
    [STATE.RESOLVE_UNTIL]: state.resolveUntil,
    [STATE.COURAGE_UNTIL]: state.courageUntil,
    [STATE.VIRTUE_HIT_COUNTS]: state.virtueHitCounts,
    [STATE.LETHAL_TEMPO]: state.lethalTempo
  });
}
