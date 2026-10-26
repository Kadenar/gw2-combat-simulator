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

/** A removed condition stays removed independently of the shatter's resource and strike transactions. */
export function mesmerShatterCondition(context: unknown, id: SkillId, name: string) {
  const skill = requireSkillFromContext(context, id);
  return requireEffect(skill, 'condition', name, requireSkillAction(skill, 'shatter'));
}
