import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { effectFirstAt } from '#gw2/platform/effects/materializer.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';

/** Preserves Shared Wisdom's position among this skill's accepted actions. */
export const twinMoonSharedWisdom: NonNullable<Skill['effectVariants']>[number] = {
  when: (runtime) => hasTrait(runtime, TRAIT.SHARED_WISDOM),
  profileId: PROFILE.sharedWisdom,
  transform: (_runtime, cast, effects) => {
    const first = cast.skill.effects?.find((effect) => !effect.metadata?.legendId);
    const impact = first ? effectFirstAt(cast.start, cast.fullEnd, first) : cast.fullEnd;
    return [
      ...(cast.skill.effects ?? []),
      ...effects
        .filter((effect) => effect.type === 'boon' && effect.name === 'twin-moon-sweep')
        .map((effect) => ({
          ...effect,
          name: 'Shared Wisdom — Might',
          atMs: (effectFirstAt(impact, impact, effect) - cast.start) * 1000,
          timingAnchor: 'castStart' as const,
          timingScale: 'fixed' as const
        }))
    ];
  }
};
