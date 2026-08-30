/** Registers scheduler-phase skill activations for this module. */
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { soulbeastState } from '#gw2/content/professions/ranger/specializations/soulbeast/state.js';
import type { RangerCastContext, RangerSkill } from '#gw2/content/professions/ranger/types.js';
import {
  applyUnstoppableUnion,
  soulbeastStanceDuration
} from '#gw2/content/professions/ranger/specializations/soulbeast/traits/index.js';
import { rangerBalanceValue } from '#gw2/content/professions/ranger/core/profiles.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/ranger/specializations/soulbeast/profiles.js';
import { setRangerPetActive } from '#gw2/content/professions/ranger/core/mechanics/pets.js';

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
      const duration = soulbeastStanceDuration(
        context,
        rangerBalanceValue(context, PROFILE.oneWolfPack, 'durationMultiplier', 6)
      );
      // oneWolfPackUntil is written here so the resolver's per-hit ICD guard can cheaply
      // skip the active-buff lookup when the stance has clearly expired.
      soulbeastState.from(context).oneWolfPackUntil = context.start + duration;
      emitSkillBuff(context, {
        at: context.start,
        source: 'ranger',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        kind: 'one-wolf-pack',
        duration,
        stacks: 1
      });
    }
  },
  'ranger.vulture-stance': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      emitSkillBuff(context, {
        at: context.start,
        source: 'ranger',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        kind: 'vulture-stance',
        duration: soulbeastStanceDuration(
          context,
          rangerBalanceValue(context, PROFILE.vultureStance, 'durationMultiplier', 6)
        ),
        stacks: 1
      });
    }
  }
});
