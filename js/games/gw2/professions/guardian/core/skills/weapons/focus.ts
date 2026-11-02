/** Canonical Core guardian skill definitions grouped by their GW2 owner. */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_WEAPONS_FOCUS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.RAY_OF_JUDGMENT]: {
    name: 'Ray of Judgment',
    icon: 'https://render.guildwars2.com/file/D50E0BDA07479939275BCB53A2670FC6B808BE29/2010287.png',
    type: 'Weapon',
    weapon: 'Focus',
    slot: 'Weapon_4',
    cooldown: 20,
    castTimeMs: 600,
    // Once launched, the ray keeps striking even when the remaining cast animation is cancelled.
    interruptCommitMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [1040, 1520, 2000, 2480, 2960, 3440].map((atMs) => ({ atMs, coefficient: 4.05 / 6 })),
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 3
      }
    ]
  },
  [ID.SHIELD_OF_WRATH]: {
    name: 'Shield of Wrath',
    icon: 'https://render.guildwars2.com/file/C2065BFF78BB134197076A2C7450013EE390E409/103634.png',
    type: 'Weapon',
    weapon: 'Focus',
    slot: 'Weapon_5',
    cooldown: 25,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 4000, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
};
