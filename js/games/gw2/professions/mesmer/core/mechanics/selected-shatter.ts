import { CONDITION } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { requireEffect, requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerShatter } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';

/** Project selected skill tiers while retaining resource indices and explicit removal ownership. */
export function mesmerSelectedShatter(context: unknown, id: SkillId): MesmerShatter {
  const skill = requireSkillFromContext(context, id) as MesmerSkill;
  const definition = skill.shatter!;
  const action = requireSkillAction(skill, 'shatter');
  return {
    ...definition,
    strikes: Array.from({ length: definition.tierCount }, (_, tier) =>
      requireEffect(skill, 'strike', `${tier} resources`, action)
    )
  };
}

/** Removed Confusion stays removed independently of the shatter's resource and strike transactions. */
export function mesmerShatterConfusion(context: unknown, id: SkillId) {
  const skill = requireSkillFromContext(context, id);
  return requireEffect(skill, 'condition', CONDITION.CONFUSION, requireSkillAction(skill, 'shatter'));
}
