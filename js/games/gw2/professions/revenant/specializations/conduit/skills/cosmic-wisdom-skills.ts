/** Owns Conduit Cosmic Wisdom form and attack skills; Demon button aliases resolve to Core skills. */
// Incoming-hit retaliation is outside combat scope and has no declared attack in this catalog.
import { ACTOR } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

export const CONDUIT_COSMIC_WISDOM_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RevenantSkill>>> = {
  [ID.FORM_OF_THE_DERVISH_ATTACK]: {
    name: 'Form of the Dervish (Attack)',
    icon: 'https://render.guildwars2.com/file/0CB866CA45E05F72B3B9CEDED5CAA1563FBD6B4A/3680046.png',
    type: 'Action',
    slot: 'Action',

    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Form of the Dervish (Attack)',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.SHIELDING_HANDS]: {
    name: 'Shielding Hands',
    icon: 'https://render.guildwars2.com/file/274EEBFD624D0DA55A0C7F7566D41A060E48B4BA/3680199.png',
    type: 'Heal',
    slot: 'Heal',
    cooldown: 30,
    energyCost: 5,
    legendId: 'LegendaryEntity',
    castTimeMs: 1000,
    effects: [],
    // A completed heal grants Shared Wisdom's Protection through the same trait hook as Entity utilities.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.entity-boon-completed' } }]
  },
  [ID.FORM_OF_THE_DERVISH_ATTACK_ELITE]: {
    name: 'Form of the Dervish (Attack - Elite)',
    icon: 'https://render.guildwars2.com/file/0CB866CA45E05F72B3B9CEDED5CAA1563FBD6B4A/3680046.png',
    type: 'Action',
    slot: 'Action',

    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Form of the Dervish (Attack - Elite)',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.COSMIC_WISDOM]: {
    name: 'Cosmic Wisdom',
    icon: 'https://render.guildwars2.com/file/5DA12A719EBDBFA95C7F416BAC7101D035DEBC22/3680202.png',
    type: 'Profession',
    slot: 'Profession_3',
    cooldown: 20,
    energyCost: 0,
    // Custom: Activates the Cosmic Wisdom affinity window; see `conduit/hooks.ts`.
    castTimeMs: 0,
    effects: [
      {
        name: 'cosmic-wisdom',
        type: 'buff',
        kind: 'cosmic-wisdom',
        duration: 7,
        stacks: 1,
        actorType: ACTOR.PLAYER
      }
    ],
    // Complete pre-form trait rewards before opening the form and publishing its gift.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.cosmic-wisdom' } }]
  },
  [ID.LESSER_ENCHANTED_DAGGERS]: {
    name: 'Lesser Enchanted Daggers',
    icon: 'https://render.guildwars2.com/file/23760CCE7F3271041121BA089A4D2453166BB52C/961421.png',
    type: 'Action',
    slot: 'Action',

    cooldown: 1,
    energyCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        // Daggers siphon a flat base plus Power scaling, bypassing armor and critical strikes.
        coefficient: 0,
        damageKind: 'life-steal',
        flatStrikeBase: 1028,
        flatStrikePowerCoeff: 0.06,
        canCrit: false,
        hits: 1,
        name: 'Lesser Enchanted Daggers',
        actorType: ACTOR.PLAYER
      }
    ]
  }
};
