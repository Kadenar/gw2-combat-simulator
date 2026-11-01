/**
 * Owns Evoker meditation heal, utility, and elite skill definitions.
 * Meditation trait reactions are registered by the Evoker module.
 */
import { boonKey, buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import { ACTOR, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';

/** Declares the meditation catalog while the shared handler applies Altruistic Aspect. */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const EVOKER_MEDITATION_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.FOXS_FURY]: {
    name: "Fox's Fury",
    description:
      'Meditation. Grant boons to nearby allies, then inflict burning on your target based on the amount of might you have. If fire is your specialized element, this skill breaks stun, grants additional boons, and strikes enemies around your target.',
    icon: 'https://render.guildwars2.com/file/7AE9F87947BFA633B39A0977A211465549442A65/3680121.png',
    // Commit the live-element reward before Altruistic Aspect; acceptance-time damage selection stays independent.
    mightTierThreshold: 10,
    type: 'Utility',
    slot: 'Utility',

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
    description:
      'Meditation. Gain endurance and swiftness. Your next few strikes create an arc of chain lightning. If air is your specialized element, this skill breaks stun and grants blur.',
    icon: 'https://render.guildwars2.com/file/CD54CEBF6BD8D37902E2EF0565BE0A9FF3CB9414/3680122.png',
    type: 'Utility',
    slot: 'Utility',

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
    description:
      'Meditation. Block incoming attacks, then strike nearby enemies with shattering rocks. Grant protection to nearby allies if this skill completes successfully. If earth is your specialized element, this skill grants resistance to allies and breaks stun.',
    icon: 'https://render.guildwars2.com/file/A3DE41C7F223D46269FCC406AEFCDF01ABCF4BE1/3680124.png',
    type: 'Utility',
    slot: 'Utility',

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
    description: 'Meditation. Summon all four familiars to use their empowered skills.',
    icon: 'https://render.guildwars2.com/file/D401E6E2BE0349A03F37E02AE850CF3419D438C3/3680111.png',
    type: 'Elite',
    slot: 'Elite',

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
    description: 'Meditation. Heal yourself and charge your familiar skill.',
    icon: 'https://render.guildwars2.com/file/0CB5DE5B0D0A4E360C1F0F24E655F478C2DAA6B8/3680112.png',
    type: 'Heal',
    slot: 'Heal',

    cooldown: 18,
    skillFamily: 'Meditation',
    castTimeMs: 600,
    effects: [],
    // Commit the live-element reward before Altruistic Aspect; acceptance-time damage selection stays independent.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.evoker.rejuvenate' } }]
  }
});
