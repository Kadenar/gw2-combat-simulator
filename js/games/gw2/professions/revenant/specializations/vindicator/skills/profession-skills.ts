/** Owns Vindicator profession actions, stance identities, and legend-call fragments. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const VINDICATOR_PROFESSION_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ALLIANCE_TACTICS]: {
    // Custom: Swaps Alliance stance and its active skill set; see `vindicator/mechanics/dodge.ts`.
    handlerId: 'revenant.alliance-tactics',
    castTimeMs: 0,
    cooldown: 3,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_ALLIANCE_STANCE_ID_62749]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.ENERGY_MELD]: {
    // Custom: Restores endurance and applies Vindicator trait adjustments; see `vindicator/mechanics/dodge.ts`.
    handlerId: 'revenant.energy-meld',
    quicknessCastTimeMs: 440,
    cooldown: 20,
    energyCost: 10,
    resourceGain: 25,
    effects: []
  },
  [ID.ENERGY_MELD_ID_72058]: {
    // Custom: Restores endurance and applies Vindicator trait adjustments; see `vindicator/mechanics/dodge.ts`.
    handlerId: 'revenant.energy-meld',
    quicknessCastTimeMs: 440,
    cooldown: 20,
    energyCost: 10,
    resourceGain: 25,
    effects: []
  },
  [ID.CALL_OF_THE_ALLIANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    resourceGain: 8,
    effects: [
      {
        type: 'strike',
        coefficient: 0.93,
        hits: 1,
        name: 'Call of the Alliance',
        actorType: 'player'
      }
    ]
  },
  [ID.LEGENDARY_ALLIANCE_STANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  }
});
