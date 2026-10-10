import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { cloneNecromancerAttributes } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { necromancerLifeForceCostMultiplier } from '#gw2/professions/necromancer/core/state.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { party } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/audiences.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

import { darkBarrageEffects } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/dark-barrage.js';
import { HARBINGER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';

/** Applies Alchemic Vigor at the original attribute-conversion position. */
export function modifyAlchemicVigorAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (context.config?.specialization === 'Harbinger' || hasTrait(context, TRAIT.ALCHEMIC_VIGOR)) {
    const alchemicVigorProfile = requireBalanceProfileFromContext(context, TRAIT.ALCHEMIC_VIGOR);
    result.vitality += balanceProfileNumber(alchemicVigorProfile, 'attributeBonus');
  }
}

/** Applies Implacable Foe at the original attribute-conversion position. */
export function modifyImplacableFoeAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.IMPLACABLE_FOE)) {
    const implacableFoeProfile = requireBalanceProfileFromContext(context, TRAIT.IMPLACABLE_FOE);
    result.ferocity += result.vitality * balanceProfileNumber(implacableFoeProfile, 'attributeConversion');
  }
}

/** Applies Twisted Medicine at the original attribute-conversion position. */
export function modifyTwistedMedicineAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.TWISTED_MEDICINE)) {
    const twistedMedicineProfile = requireBalanceProfileFromContext(context, TRAIT.TWISTED_MEDICINE);
    result.concentration += result.vitality * balanceProfileNumber(twistedMedicineProfile, 'attributeConversion');
  }
}

/** Applies Dark Gunslinger at the original attribute-conversion position. */
export function modifyDarkGunslingerAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.DARK_GUNSLINGER)) {
    const darkGunslingerProfile = requireBalanceProfileFromContext(context, TRAIT.DARK_GUNSLINGER);
    // Alchemic Vigor and other flat Vitality bonuses precede conversion.
    result.expertise += Math.round(
      result.vitality * balanceProfileNumber(darkGunslingerProfile, 'attributeConversion')
    );
  }
}

/** Doom Approaches turns the shroud control into Fear so condition duration and Fear reactions apply. */
export function doomApproachesControl(runtime: NecromancerRuntime, effect: SkillEffect): SkillEffect {
  if (effect.type !== 'control' || !hasTrait(runtime, TRAIT.DOOM_APPROACHES)) return effect;
  const fields = { ...effect };
  delete fields.controlKind;
  return { ...fields, type: 'condition', condition: 'Fear', stacks: 1, duration: 1 };
}

/** The trait selects the pulse amount; the mechanic still accrues and expires stacks. */
export function doomApproachesBlightProfile(runtime: NecromancerRuntime) {
  return hasTrait(runtime, TRAIT.DOOM_APPROACHES) ? TRAIT.DOOM_APPROACHES : PROFILE.resources;
}

/** Only delivered boon packets expand to party recipients. */
export function twistedMedicineAudience(runtime: NecromancerRuntime, effect: SkillEffect) {
  return effect.type === 'boon' && hasTrait(runtime, TRAIT.TWISTED_MEDICINE) ? party(runtime) : effect.audience;
}

/** Selects and materializes Doom Approaches before the skill scheduler owns the resulting pulses. */
export const doomApproachesDarkBarrage: NonNullable<Skill['effectVariants']> = [
  {
    when: (runtime) => hasTrait(runtime, TRAIT.DOOM_APPROACHES),
    profileId: PROFILE.darkBarrageDoomApproaches,
    transform: (runtime, _cast, effects) => {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.darkBarrageDoomApproaches);
      return darkBarrageEffects(profile, effects);
    }
  }
];

/** Harbinger capacity includes Alchemic Vigor exactly once when static build rules were not applied. */
export function alchemicVigorLifeForceCostMultiplier(runtime: MechanicQueriesOf<NecromancerRuntime>): number {
  if (
    !professionStaticRulesApplied(runtime.config) &&
    (runtime.config.specialization === 'Harbinger' || hasTrait(runtime, TRAIT.ALCHEMIC_VIGOR))
  ) {
    const vitality =
      (runtime.config.stats?.vitality ?? 1000) +
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.ALCHEMIC_VIGOR), 'attributeBonus');
    return necromancerLifeForceCostMultiplier(
      { ...runtime.config, stats: { ...runtime.config.stats, vitality } },
      runtime
    );
  }

  return runtime.profession.core.lifeForceCostMultiplier;
}
