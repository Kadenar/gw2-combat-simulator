import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { party } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/audiences.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

import { darkBarrageEffects } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/dark-barrage.js';
import { HARBINGER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';

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
