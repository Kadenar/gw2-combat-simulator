import { emitSkillBuff } from '../../../../../../platform/scheduler/skill-events.js';
import { hasTrait } from '../../../../../../platform/combat/state/traits.js';
import type { Skill } from '../../../../../../platform/engine/types.js';
import type { ElementalistCastContext } from '../../../types.js';
import { elementalistBalanceEffect } from '../../../core/profiles.js';
import { ALTRUISTIC_ASPECT_BOONS } from '../mechanics/constants.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '../profiles.js';

export function applyAltruisticAspect(context: ElementalistCastContext, skill: Skill): void {
  if (!hasTrait(context, 'Altruistic Aspect')) return;
  const boon = ALTRUISTIC_ASPECT_BOONS.get(skill.id);
  if (!boon) return;
  const effect = elementalistBalanceEffect(context, PROFILE.altruisticAspect, 'boon', skill.name);
  emitSkillBuff(context, skill, {
    at: context.effectiveEnd,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    kind: String(effect?.boon || boon[0]).toLowerCase(),
    stacks: Number(effect?.stacks ?? boon[1]),
    duration: Number(effect?.duration ?? boon[2]),
    skillName: skill.name
  });
}
