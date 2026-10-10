import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Sphere Specialist permits accepted hits to restore energy while a sphere remains active. */
export function sphereSpecialistAllowsEnergy(context: ElementalistRuntime): boolean {
  return hasTrait(context, TRAIT.SPHERE_SPECIALIST);
}

/** Read the active duration tuning at deployment for both sphere packets and Spectacular Sphere payouts. */
export function sphereSpecialistDuration(context: ElementalistRuntime): number {
  return hasTrait(context, TRAIT.SPHERE_SPECIALIST)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SPHERE_SPECIALIST), 'durationMultiplier')
    : 1;
}

/** Extend only authored boons and buffs, leaving damage and field windows unchanged. */
export function applySphereSpecialistDurations(
  context: ElementalistRuntime,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  if (!hasTrait(context, TRAIT.SPHERE_SPECIALIST)) return effects;
  const multiplier = sphereSpecialistDuration(context);
  return effects.map((effect) =>
    effect.type === 'boon' || effect.type === 'buff' ? { ...effect, duration: effect.duration * multiplier } : effect
  );
}
