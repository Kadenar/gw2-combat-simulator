import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { type SkillEffect } from '#gw2/platform/effects/types.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { type Skill } from '#gw2/platform/skills/types.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { type EngineerRuntime } from '#gw2/professions/engineer/types.js';

/** Adrenal Implant owns its additive endurance bonus alongside its dodge recharge reduction. */
export function adrenalImplantEnduranceBonus(context: EngineerRuntime): number {
  return hasTrait(context.traits, TRAIT.ADRENAL_IMPLANT)
    ? balanceNumberFromContext(context, TRAIT.ADRENAL_IMPLANT, 'enduranceRegenerationBonus')
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
