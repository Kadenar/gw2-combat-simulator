/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.CRYSTAL_HIBERNATION]: {
    castTimeMs: 3000,
    cooldown: 25,
    energyCost: 20,
    effects: []
  },
  [ID.ENVOY_OF_EXUBERANCE]: {
    castTimeMs: 750,
    cooldown: 15,
    energyCost: 8,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 4,
        stacks: 1
      }
    ]
  }
});
