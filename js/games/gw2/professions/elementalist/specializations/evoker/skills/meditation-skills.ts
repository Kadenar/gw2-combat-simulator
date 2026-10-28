/**
 * Owns Evoker meditation heal, utility, and elite skill fragments.
 * Meditation trait reactions are registered by the Evoker module.
 */
import { boonKey, buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import { ACTOR, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';

/** Declares the meditation catalog while the shared handler applies Altruistic Aspect. */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const EVOKER_MEDITATION_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.FOXS_FURY]: {
    name: "Fox's Fury",
    // Commit the live-element reward before Altruistic Aspect; acceptance-time damage selection stays independent.
    mightTierThreshold: 10,
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Evoker',
    categories: ['Meditation'],
    cooldown: 18,
    skillFamily: 'Meditation',
    castTimeMs: 600,
    // Custom: Applies Altruistic Aspect after the meditation effects; see `evoker/module.ts`.

    // Tier timing belongs to each selected packet; this cast's own boons cannot raise its accepted tier.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', name: 'Tier 1', coefficient: 1.5, hits: 1 },
      { type: 'condition', name: 'Tier 1', condition: CONDITION.BURNING, stacks: 1, duration: 3 },
      { type: 'strike', name: 'Tier 2', coefficient: 2.25, hits: 1 },
      { type: 'condition', name: 'Tier 2', condition: CONDITION.BURNING, stacks: 2, duration: 5 },
      { type: 'strike', name: 'Tier 3', coefficient: 3, hits: 1 },
      { type: 'condition', name: 'Tier 3', condition: CONDITION.BURNING, stacks: 3, duration: 5 }
    ]),
    // Snapshot the Might tier at acceptance; committed packets persist, while the common scheduler owns targeting/delay.
    effectVariants: [
      {
        // Always select the transform: falling through would emit all three tier templates, including on cancellation.
        when: () => true,
        transform: (runtime, cast, effects) => {
          // A cancelled meditation must not fall back to emitting every unselected tier.
          if (cast.cancelled) return [];

          const might = runtime.config.boons?.might
            ? Number(runtime.config.boons.might)
            : buffApplicationStacks(
                runtime.combat.boonApplications(boonKey(BOON.MIGHT)),
                boonKey(BOON.MIGHT),
                cast.start,
                25,
                {
                  includes: (application) => application.resolvedAudience.includesSelf
                }
              );
          const threshold = skillNumber(cast.skill, 'mightTierThreshold');
          const tier = might >= threshold * 2 ? 3 : might >= threshold ? 2 : 1;
          return effects
            .filter((effect) => effect.name === `Tier ${tier}`)
            .flatMap((effect): SkillEffect[] => {
              const timing = {
                persistsAfterInterrupt: true,
                source: cast.skill.name,
                actorType: ACTOR.PLAYER
              };

              if (effect.type === 'strike')
                return [{ ...effect, ...timing, name: cast.skill.name, weapon: 'Unequipped' }];

              if (effect.type !== 'condition') return [];

              return [
                {
                  ...effect,
                  ...timing,
                  name: `${cast.skill.name} \u2014 ${effect.condition}`,
                  stacks: Number(effect.stacks)
                }
              ];
            });
        }
      }
    ],
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.evoker.foxs-fury',
          id: 'boons',
          effects: [
            { type: 'boon', name: 'Fox Might', boon: BOON.MIGHT, stacks: 8, duration: 10 },
            { type: 'boon', name: 'Fox Fire Bonus', boon: BOON.MIGHT, stacks: 3, duration: 10 },
            { type: 'boon', name: 'Fox Fury', boon: BOON.FURY, stacks: 1, duration: 10 }
          ]
        }
      }
    ]
  },
  [ID.HARES_AGILITY]: {
    name: "Hare's Agility",
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Evoker',
    categories: ['Meditation'],
    cooldown: 20,
    resourceGain: 50,
    skillFamily: 'Meditation',
    castTimeMs: 0,
    // Custom: Applies Altruistic Aspect after the meditation effects; see `evoker/module.ts`.

    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.4 },
      { type: 'boon', boon: BOON.SWIFTNESS, stacks: 1, duration: 10 }
    ]),
    // Committed activations restore endurance using this skill's editable amount.
    sideEffects: [
      {
        on: 'castCommit',
        do: { type: 'resourceGrant', resource: 'endurance', amount: { skillField: 'resourceGain' } }
      },
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.evoker.hares-agility',
          id: 'electric-enchantment',
          // Enchantment charges have their own lifetime; the separate resource grant restores endurance.
          effects: [{ type: 'buff', name: 'Hare Enchantment', stacks: 5, duration: 10 }]
        }
      }
    ]
  },
  [ID.TOADS_FORTITUDE]: {
    name: "Toad's Fortitude",
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Evoker',
    categories: ['Meditation'],
    cooldown: 15,
    skillFamily: 'Meditation',
    castTimeMs: 640,
    // Custom: Applies Altruistic Aspect after the meditation effects; see `evoker/module.ts`.

    effects: impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.5 },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 4, duration: 10 }
    ]),
    // Commit the live-element reward before Altruistic Aspect; acceptance-time damage selection stays independent.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime) => evokerState.from(runtime).element === 'Earth',
        do: {
          type: 'elementalist.evoker.toads-fortitude',
          id: 'earth-resistance',
          effects: [
            {
              type: 'boon',
              name: 'Toad Resistance',
              boon: BOON.RESISTANCE,
              // The deferred Earth reward shares its selected duration with the capped party audience.
              audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
              stacks: 1,
              duration: 4
            }
          ]
        }
      }
    ]
  },
  [ID.ELEMENTAL_PROCESSION]: {
    name: 'Elemental Procession',
    type: 'Elite',
    slot: 'Elite',
    specialization: 'Evoker',
    categories: ['Meditation'],
    cooldown: 60,
    skillFamily: 'Meditation',
    castTimeMs: 600,
    // Custom: Applies Altruistic Aspect after the meditation effects; see `evoker/module.ts`.

    effects: [],
    // Replay the four empowered familiars' offensive payloads without spending charges or granting enchantments.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.evoker.release-elemental-procession' } }]
  },
  [ID.REJUVENATE]: {
    name: 'Rejuvenate',
    type: 'Heal',
    slot: 'Heal',
    specialization: 'Evoker',
    categories: ['Meditation'],
    cooldown: 18,
    skillFamily: 'Meditation',
    castTimeMs: 600,
    effects: [],
    // Commit the live-element reward before Altruistic Aspect; acceptance-time damage selection stays independent.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.evoker.rejuvenate' } }]
  }
});
