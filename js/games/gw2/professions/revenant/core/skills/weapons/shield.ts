/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { BOON, RECIPIENT } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';

export const REVENANT_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.ENVOY_OF_EXUBERANCE]: {
    cooldown: 15,
    energyCost: 8,
    castTimeMs: 520,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.PROTECTION,
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.AEGIS,
        duration: 4,
        stacks: 1
      }
    ]
  },
  [ID.CRYSTAL_HIBERNATION]: {
    cooldown: 25,
    energyCost: 20,
    castTimeMs: 2000,
    effects: []
  }
});
