/** Canonical Core guardian skill definitions grouped by their GW2 owner. */
import { BOON, COMBO_FIELD, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.SWORD_OF_WRATH]: {
    name: 'Sword of Wrath',
    icon: 'https://render.guildwars2.com/file/29742A41232437EE7C7025E65CA21509040621AF/103646.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    // Sword chain hits land before their recovery animations, allowing committed cancels to advance the chain.
    interruptCommitMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        atMs: 200,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.SWORD_ARC]: {
    name: 'Sword Arc',
    icon: 'https://render.guildwars2.com/file/C3446A6CD8E81B1A4B3E945DED582AD506ABEDC9/103647.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 520,
    interruptCommitMs: 280,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.SWORD_WAVE]: {
    name: 'Sword Wave',
    icon: 'https://render.guildwars2.com/file/EE60D5DCE54CEF6108417BD7AF5758806D2A4066/103705.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 680,
    interruptCommitMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.65,
        hits: 3,
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.SYMBOL_OF_BLADES]: {
    name: 'Symbol of Blades',
    icon: 'https://render.guildwars2.com/file/E7F5FFA84F0AE4EA0EC5AE54FA365C09925551A0/103641.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_2',

    cooldown: 8,
    shadowstepSkill: true,
    // Author symbol identity independently of the skill's display text.
    tags: ['symbol'],
    castTimeMs: 560,
    // The symbol is placed before the animation ends and continues pulsing after a committed cancel.
    interruptCommitMs: 320,
    // The Light field begins with the first symbol pulse and lasts through the fifth.
    comboFields: [
      { ownerId: 'guardian', fieldType: COMBO_FIELD.LIGHT, duration: 4, startMs: 320, startAnchor: 'castStart' }
    ],
    effects: [
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        coefficient: 3.25 / 5,
        atMs: 320,
        applications: 5,
        intervalMs: 1000,
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 3
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 2,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY }
      }
    ]
  },
  [ID.ZEALOTS_DEFENSE]: {
    name: "Zealot's Defense",
    icon: 'https://render.guildwars2.com/file/C0ED0D01EA4116136DCBE4925B1C2B92A209B221/103648.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_3',
    cooldown: 12,
    castTimeMs: 1400,
    // Cancelling the channel retains only projectiles that arrive within the observed cast window.
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: [400, 400, 640, 680, 880, 880, 1120, 1160].map((atMs) => ({ atMs, coefficient: 4.8 / 8 })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.EXECUTIONERS_CALLING]: {
    name: "Executioner's Calling",
    icon: 'https://render.guildwars2.com/file/ECB53EFD2308DAB756D8CC6EA852B9C4E4BFE16A/2479371.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_4',
    cooldown: 12,
    // The initial slash and dual strike occupy one cast, with damage on each segment's impact.
    castTimeMs: 1040,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        // The initial strike marks the same target, increasing the four follow-up hits by 20%.
        coefficient: 2.5 * 1.2,
        hits: 4,
        atMs: 880,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: "Executioner's Calling — Secondary Attacks"
      }
    ]
  },
  [ID.ADVANCING_STRIKE]: {
    name: 'Advancing Strike',
    icon: 'https://render.guildwars2.com/file/C6C4F63B3BE6D7CB0163F25E5A51029023F7B492/2479372.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_5',
    cooldown: 18,
    shadowstepSkill: true,
    castTimeMs: 520,
    // The dash lands two strikes before its recovery ends.
    effects: [
      {
        type: 'strike',
        ticks: [320, 360].map((atMs) => ({ atMs, coefficient: 1.75 })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        // The first strike immobilizes once; the second strike does not refresh it (wiki: Advancing_Strike).
        type: 'condition',
        ticks: [{ atMs: 320, condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  }
};
