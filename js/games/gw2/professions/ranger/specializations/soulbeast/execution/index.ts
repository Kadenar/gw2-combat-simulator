/** Registers scheduler-phase skill activations for this module. */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { soulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import type { RangerCastContext, RangerSkill } from '#gw2/professions/ranger/types.js';
import {
  applyUnstoppableUnion,
  emitSoulbeastStance
} from '#gw2/professions/ranger/specializations/soulbeast/traits/index.js';

import { SOULBEAST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import { setRangerPetActive } from '#gw2/professions/ranger/core/mechanics/pets.js';

function emitBeastmodeState(context: RangerCastContext, skill: RangerSkill, active: boolean): void {
  // Mutate scheduler state immediately so subsequent casts in the same tick see the correct mode.
  soulbeastState.from(context).beastmodeActive = active;
  setRangerPetActive(context, !active, context.start);
  context.emit({
    type: 'ranger.beastmode',
    at: context.start,
    source: 'ranger',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    active
  });
  applyUnstoppableUnion(context, skill);
}

export const soulbeastSkillHandlers = Object.freeze({
  'ranger.beastmode-enter': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      emitBeastmodeState(context, skill, true);
    }
  },
  'ranger.beastmode-exit': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      emitBeastmodeState(context, skill, false);
    }
  },
  'ranger.one-wolf-pack': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const duration = emitSoulbeastStance(
        context,
        skill,
        'one-wolf-pack',
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.oneWolfPack), 'durationMultiplier')
      );
      // Keep the public stance timer aligned with the personal application.
      soulbeastState.from(context).oneWolfPackUntil = context.start + duration;
    }
  },
  'ranger.vulture-stance': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      emitSoulbeastStance(
        context,
        skill,
        'vulture-stance',
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.vultureStance), 'durationMultiplier')
      );
    }
  }
});
