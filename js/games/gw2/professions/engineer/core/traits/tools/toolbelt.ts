import { type EngineerRuntime } from '#gw2/professions/engineer/types.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/core/profiles.js';
import { type Skill } from '#gw2/platform/skills/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { type SkillEffect } from '#gw2/platform/effects/types.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
/** Adrenal Implant adds to Vigor using the existing resource profile's patch target. */
export function adrenalImplantEnduranceBonus(context: EngineerRuntime): number {
  return hasTrait(context.traits, TRAIT.ADRENAL_IMPLANT)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'coefficientMultiplier') - 1
    : 0;
}

/** Adds one independently grouped mine blast before packets materialize, preserving the single control packet. */
export const gadgeteerMineVariant: NonNullable<Skill['effectVariants']>[number] = {
  profileId: TRAIT.GADGETEER,
  when: (runtime) => hasTrait(runtime, TRAIT.GADGETEER),
  transform: (_runtime, cast) =>
    (cast.skill.effects ?? []).flatMap<SkillEffect>((effect) =>
      effect.type === 'strike'
        ? [
            effect,
            {
              ...effect,
              comboFinishers: effect.comboFinishers?.map((finisher) => ({
                ...finisher,
                attemptGroup: 'gadgeteer-mine'
              }))
            }
          ]
        : [effect]
    )
};
