/**
 * Evoker trait behaviour that hangs off skill execution rather than off a
 * mechanic hook - currently just Altruistic Aspect's meditation boons.
 */
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { requireEffectFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ElementalistCastContext } from '#gw2/professions/elementalist/types.js';
import { ALTRUISTIC_ASPECT_SKILLS } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

/**
 * Grants Altruistic Aspect's per-meditation boon when the trait is slotted and
 * the completing skill is one of the four it covers; otherwise a no-op.
 */
export function applyAltruisticAspect(context: ElementalistCastContext, skill: Skill): void {
  if (!hasTrait(context, 'Altruistic Aspect')) return;
  if (!ALTRUISTIC_ASPECT_SKILLS.has(skill.id)) return;
  const effect = requireEffectFromContext(context, 'balance-profile', PROFILE.altruisticAspect, 'boon', skill.name);
  if (effect) {
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      kind: String(effect.boon).toLowerCase(),
      stacks: Number(effect.stacks),
      duration: Number(effect.duration),
      skillName: skill.name
    });
  }
}
