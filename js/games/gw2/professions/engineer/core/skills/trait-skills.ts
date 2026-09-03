/**
 * Owns Core Engineer fragments created by trait procs and trait-triggered actions.
 * Trait reaction logic remains in `core/traits/`; this file owns only their skill data.
 */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines the catalog fragments used by Core Engineer trait effects. */
export const ENGINEER_TRAIT_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.LESSER_GRENADE_BARRAGE]: {
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 6,
        atMs: 0,
        name: 'Lesser Grenade Barrage',
        actorType: 'player'
      }
    ]
  },
  [ID.LESSER_ELIXIR_B]: {
    castTimeMs: 0,
    cooldown: 24,
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 8,
        stacks: 1
      }
    ]
  },
  [ID.STATIC_DISCHARGE_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1,
        name: 'Static Discharge (trait skill)',
        actorType: 'player'
      }
    ]
  },
  [ID.DROP_MINE]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        name: 'Drop Mine',
        actorType: 'player'
      }
    ]
  },
  [ID.MAGNETIC_BOMB_TRAIT_SKILL]: {
    interruptCommitMs: 0,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'pull',
        duration: 300
      }
    ]
  },
  [ID.SUPERSPEED_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.FIRE_SHIELD_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 1
      }
    ]
  },
  [ID.MAGNETIC_AURA_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.BUNKER_DOWN_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 0.95,
        hits: 1,
        name: 'Bunker Down (trait skill)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 6,
        duration: 8,
        actorType: 'player'
      }
    ]
  },
  [ID.INVISIBLE_ANALYSIS]: {
    castTimeMs: 0,
    cooldown: 25,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.CLEANSING_PULSE]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'boon',
        boon: 'Regeneration',
        duration: 4,
        stacks: 1
      }
    ]
  },
  [ID.LESSER_UTILITY_GOGGLES]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Aim-Assisted Rocket (trait skill)',
        actorType: 'player'
      }
    ]
  },
  [ID.BANDAGE_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.ORBITAL_COMMAND_STRIKE]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.92,
        hits: 1,
        name: 'Orbital Command Strike',
        actorType: 'player'
      }
    ]
  },
  [ID.CONTROLLED_ANALYSIS]: {
    castTimeMs: 0,
    cooldown: 25,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 0.25,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Explosive Entrance (trait skill)',
        actorType: 'player'
      }
    ]
  }
});
