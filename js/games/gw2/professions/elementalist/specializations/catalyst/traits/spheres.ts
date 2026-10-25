import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Sphere Specialist permits accepted hits to restore energy while a sphere remains active. */
export function sphereSpecialistAllowsEnergy(context: ElementalistRuntime): boolean {
  return hasTrait(context, TRAIT.SPHERE_SPECIALIST);
}

/** Read the active duration tuning at deployment for both sphere packets and Spectacular Sphere payouts. */
export function sphereSpecialistDuration(context: ElementalistRuntime): number {
  return hasTrait(context, TRAIT.SPHERE_SPECIALIST)
    ? balanceNumberFromContext(context, TRAIT.SPHERE_SPECIALIST, 'durationMultiplier')
    : 1;
}

/** Resolve selection once, then extend only authored boons and buffs when the multiplier changes their duration. */
export function applySphereSpecialistDurations(
  context: ElementalistRuntime,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  const multiplier = sphereSpecialistDuration(context);

  if (multiplier === 1) return effects;

  return effects.map((effect) =>
    effect.type === 'boon' || effect.type === 'buff' ? { ...effect, duration: effect.duration * multiplier } : effect
  );
}
