/**
 * Owns Evoker meditation heal, utility, and elite skill fragments.
 * Meditation trait reactions are registered by the Evoker module.
 */
import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill, SkillEffect } from '#gw2/platform/engine/skills/types.js';

/** Declares the meditation catalog while the shared handler applies Altruistic Aspect. */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const EVOKER_MEDITATION_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.FOXS_FURY]: {
    // Snapshot the Might tier at acceptance; committed packets persist, while the common scheduler owns targeting/delay.
    effectVariants: [
      {
        when: (_runtime, cast) => !cast.cancelled,
        profileId: PROFILE.foxsFury,
        transform: (runtime, cast, effects) => {
          const might = runtime.config.boons?.might
            ? Number(runtime.config.boons.might)
            : buffApplicationStacks(runtime.boons.get('might') ?? [], 'might', cast.start, 25, {
                includes: (application) => application.resolvedAudience?.includesSelf !== false
              });
          const profile = requireBalanceProfileFromContext(runtime, PROFILE.foxsFury);
          const threshold = balanceProfileNumber(profile, 'threshold');
          const tier = might >= threshold * 2 ? 3 : might >= threshold ? 2 : 1;
          return effects
            .filter((effect) => effect.name === `Tier ${tier}`)
            .flatMap((effect): SkillEffect[] => {
              const timing = {
                atMs: balanceProfileNumber(profile, 'initialDelay') * 1000,
                timingAnchor: 'castStart' as const,
                timingScale: 'cast' as const,
                persistsAfterInterrupt: true,
                source: cast.skill.name,
                actorType: 'player' as const
              };
              if (effect.type === 'strike')
                return [{ ...effect, ...timing, name: cast.skill.name, weapon: 'Unequipped' }];
              if (effect.type !== 'condition') return [];
              // Each Burning stack remains a separate application, including a fractional final stack for patched tuning.
              return Array.from({ length: Math.ceil(Number(effect.stacks)) }, (_, index) => ({
                ...effect,
                ...timing,
                name: `${cast.skill.name} \u2014 ${effect.condition}`,
                stacks: Math.min(1, Number(effect.stacks) - index)
              }));
            });
        }
      }
    ],
    name: "Fox's Fury",
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Evoker',
    categories: ['Meditation'],
    castTimeMs: 600,
    cooldown: 18,
    skillFamily: 'Meditation',
    // Custom: Applies Altruistic Aspect after the meditation effects; see `evoker/module.ts`.

    effects: []
  },
  [ID.HARES_AGILITY]: {
    name: "Hare's Agility",
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Evoker',
    categories: ['Meditation'],
    castTimeMs: 0,
    cooldown: 20,
    resourceGain: 50,
    // Committed activations restore endurance using this skill's editable amount.
    sideEffects: [
      { on: 'castCommit', do: { type: 'resourceGrant', resource: 'endurance', amount: { skillField: 'resourceGain' } } }
    ],
    skillFamily: 'Meditation',
    // Custom: Applies Altruistic Aspect after the meditation effects; see `evoker/module.ts`.

    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.4 },
      { type: 'boon', boon: 'Swiftness', stacks: 1, duration: 10, metadata: {} }
    ])
  },
  [ID.TOADS_FORTITUDE]: {
    name: "Toad's Fortitude",
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Evoker',
    categories: ['Meditation'],
    castTimeMs: 640,
    cooldown: 15,
    skillFamily: 'Meditation',
    // Custom: Applies Altruistic Aspect after the meditation effects; see `evoker/module.ts`.

    effects: impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.5 },
      { type: 'condition', condition: 'Bleeding', stacks: 4, duration: 10, metadata: {} }
    ])
  },
  [ID.ELEMENTAL_PROCESSION]: {
    name: 'Elemental Procession',
    type: 'Elite',
    slot: 'Elite',
    specialization: 'Evoker',
    categories: ['Meditation'],
    castTimeMs: 600,
    cooldown: 60,
    skillFamily: 'Meditation',
    // Custom: Applies Altruistic Aspect after the meditation effects; see `evoker/module.ts`.

    effects: []
  },
  [ID.REJUVENATE]: {
    name: 'Rejuvenate',
    type: 'Heal',
    slot: 'Heal',
    specialization: 'Evoker',
    categories: ['Meditation'],
    castTimeMs: 600,
    cooldown: 18,
    skillFamily: 'Meditation',
    effects: []
  }
});
