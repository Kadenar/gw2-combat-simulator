/**
 * Evoker trait behaviour that hangs off skill execution rather than off a
 * mechanic hook - currently just Altruistic Aspect's meditation boons.
 */
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { balanceProfileEffectFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import type { ElementalistCastContext } from '#gw2/professions/elementalist/types.js';
import { ALTRUISTIC_ASPECT_BOONS } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

/**
 * Grants Altruistic Aspect's per-meditation boon when the trait is slotted and
 * the completing skill is one of the four it covers; otherwise a no-op.
 */
export function applyAltruisticAspect(context: ElementalistCastContext, skill: Skill): void {
  if (!hasTrait(context, 'Altruistic Aspect')) return;
  const boon = ALTRUISTIC_ASPECT_BOONS.get(skill.id);
  if (!boon) return;
  const effect = balanceProfileEffectFromContext(context, PROFILE.altruisticAspect, 'boon', 0, skill.name);
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
