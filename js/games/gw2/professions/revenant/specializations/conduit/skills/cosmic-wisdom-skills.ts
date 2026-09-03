/** Owns Conduit Cosmic Wisdom form, attack, and alternate skill identities. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const CONDUIT_COSMIC_WISDOM_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FORM_OF_THE_DERVISH_ATTACK]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Form of the Dervish (Attack)',
        actorType: 'player'
      }
    ]
  },
  [ID.SHIELDING_HANDS]: {
    castTimeMs: 1500,
    cooldown: 30,
    energyCost: 5,
    effects: [],
    legendId: 'LegendaryEntity'
  },
  [ID.FORM_OF_THE_DERVISH_ATTACK_ELITE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Form of the Dervish (Attack - Elite)',
        actorType: 'player'
      }
    ]
  },
  [ID.COSMIC_WISDOM]: {
    // Custom: Activates the Cosmic Wisdom affinity window; see `execution/cosmic-wisdom.ts`.
    handlerId: 'revenant.cosmic-wisdom',
    castTimeMs: 0,
    cooldown: 20,
    energyCost: 0,
    effects: [
      {
        type: 'buff',
        kind: 'cosmic-wisdom',
        duration: 7,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.DWARVEN_RETRIBUTION]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1,
        name: 'Dwarven Retribution',
        actorType: 'player'
      }
    ]
  },
  [ID.LESSER_ENCHANTED_DAGGERS]: {
    castTimeMs: 0,
    cooldown: 1,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.06,
        hits: 1,
        name: 'Lesser Enchanted Daggers',
        actorType: 'player'
      }
    ]
  },
  [ID.PAIN_ABSORPTION_ID_78505]: {
    castTimeMs: 0,
    cooldown: 5,
    energyCost: 0,
    effects: []
  },
  [ID.BANISH_ENCHANTMENT_ID_78587]: {
    castTimeMs: 0,
    cooldown: 5,
    energyCost: 0,
    effects: []
  },
  [ID.EMPOWERING_MISERY_ID_78681]: {
    castTimeMs: 0,
    cooldown: 30,
    energyCost: 0,
    effects: []
  }
});
