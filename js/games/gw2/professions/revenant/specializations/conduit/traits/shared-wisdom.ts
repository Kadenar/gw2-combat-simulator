import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { effectFirstAt } from '#gw2/platform/effects/materializer.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** One entity-specific Shared Wisdom boon accompanies the cast's completion. */
export function completionSharedWisdom(
  runtime: RevenantRuntime,
  cast: RuntimeCast<RevenantSkill>,
  trigger: string
): void {
  if (!hasTrait(runtime, TRAIT.SHARED_WISDOM)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.sharedWisdom);
  const shared = requireEffect(profile, 'boon', trigger);
  if (!shared) return;
  runtime.effects.emit({
    kind: 'profile',
    profile: profile,
    effects: [shared],
    at: cast.effectiveEnd,
    attribution: {
      source: 'revenant',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id
    },
    transform: (event) => ({ ...event, name: cast.skill.name + ' \u2014 ' + event.kind })
  });
}

/** Preserves Shared Wisdom's position among this skill's accepted actions. */
export const beguilingHazeSharedWisdom: NonNullable<Skill['sideEffects']>[number] = {
  on: 'castCommit',
  when: (runtime) => hasTrait(runtime, TRAIT.SHARED_WISDOM),
  do: {
    type: 'emitProfile',
    profileId: PROFILE.sharedWisdom,
    effects: (effect) => effect.type === 'boon' && effect.name === 'beguiling-haze',
    attribution: { source: 'revenant', sourceId: TRAIT.SHARED_WISDOM, actorType: 'player' }
  }
};

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

/** Preserves Shared Wisdom's position among this skill's accepted actions. */
export const hexEaterSharedWisdom: NonNullable<Skill['sideEffects']>[number] = {
  on: 'castCommit',
  when: (runtime) => hasTrait(runtime, TRAIT.SHARED_WISDOM),
  do: {
    type: 'emitProfile',
    profileId: PROFILE.sharedWisdom,
    effects: (effect) => effect.type === 'boon' && effect.name === 'hex-eater-vortex',
    attribution: { source: 'revenant', sourceId: ID.HEX_EATER_VORTEX, actorType: 'player' }
  }
};

/** Preserves Shared Wisdom's position among this skill's accepted actions. */
export const gladiatorSharedWisdom: NonNullable<Skill['sideEffects']>[number] = {
  on: 'castCommit',
  when: (runtime) => hasTrait(runtime, TRAIT.SHARED_WISDOM),
  do: {
    type: 'emitProfile',
    profileId: PROFILE.sharedWisdom,
    effects: (effect) => effect.type === 'boon' && effect.name === 'gladiators-defense',
    attribution: { source: 'revenant', sourceId: ID.GLADIATORS_DEFENSE, actorType: 'player' }
  }
};
