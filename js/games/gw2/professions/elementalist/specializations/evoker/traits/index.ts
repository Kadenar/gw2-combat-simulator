import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
/**
 * Evoker trait behaviour that hangs off skill execution rather than off a
 * mechanic hook - currently just Altruistic Aspect's meditation boons.
 */
import { emitElementalistBuff } from '#gw2/professions/elementalist/core/live-events.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { ALTRUISTIC_ASPECT_SKILLS } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

/**
 * Grants Altruistic Aspect's per-meditation boon when the trait is slotted and
 * the completing skill is one of the four it covers; otherwise a no-op.
 */
export function applyAltruisticAspect(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  if (!hasTrait(context, 'Altruistic Aspect')) return;
  if (!ALTRUISTIC_ASPECT_SKILLS.has(skill.id)) return;
  const altruisticAspectProfile = requireBalanceProfileFromContext(context, PROFILE.altruisticAspect);
  const effect = requireEffect(altruisticAspectProfile, 'boon', skill.name);
  if (effect) {
    emitElementalistBuff(context, {
      skill: skill,
      at: cast.effectiveEnd,
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
