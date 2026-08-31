/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const WARRIOR_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.GUNSTINGER]: {
    implemented: true,
    ammo: 0,
    ammoRecharge: 0,
    cooldown: 15,
    // Gunstinger restores three Dragon's Roar charges after completion.
    mechanicTriggers: [
      {
        type: 'warrior.core.restore-dragons-roar-ammo',
        timingAnchor: 'castEnd',
        count: 3
      }
    ],
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 8
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.DRAGONS_ROAR]: {
    implemented: true,
    ammo: 6,
    ammoRecharge: 5,
    cooldown: 5,
    ammoCastLockout: 1,
    quicknessCastTimeMs: 560,
    handlerId: 'warrior.dragons-roar',
    effects: []
  }
});
