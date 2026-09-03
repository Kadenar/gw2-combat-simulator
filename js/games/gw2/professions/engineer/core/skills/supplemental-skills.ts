/**
 * Owns alternate IDs, bundle skills, and auxiliary Core Engineer skill fragments.
 * Trait-created skills and regular slot or weapon catalogs live in their named owners.
 */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines supplemental Core fragments that do not belong to a regular weapon or slot-skill catalog. */
export const ENGINEER_SUPPLEMENTAL_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.JUMP_SHOT_ID_5817]: {
    castTimeMs: 1000,
    cooldown: 18,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        name: 'Leap Damage',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 1,
        name: 'Landing Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 7,
        actorType: 'player'
      }
    ]
  },
  [ID.WITHERING_PLAGUE]: {
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 8,
        actorType: 'player'
      }
    ]
  },
  [ID.PLAGUE_OF_DARKNESS]: {
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'blind',
        actorType: 'player'
      }
    ]
  },
  [ID.PLAGUE_OF_PESTILENCE]: {
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2.5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.ALLY_WARD]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.GLUE_TRAIL]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.OVERFUELED_FLAME_JET]: {
    castTimeMs: 2250,
    cooldown: 1,
    effects: []
  },
  [ID.DROP_GUNK]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        name: 'Drop Gunk',
        actorType: 'player'
      }
    ]
  },
  [ID.LONG_FUSED_POWDER_PACK]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Long-Fused Powder Pack',
        actorType: 'player'
      }
    ]
  },
  [ID.THROW_JUNK_DOPPELGANGER]: {
    castTimeMs: 0,
    cooldown: 0.25,
    effects: [
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1,
        name: 'Throw Junk (Doppelganger)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  }
});
