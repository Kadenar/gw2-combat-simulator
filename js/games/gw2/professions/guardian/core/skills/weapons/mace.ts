/** Canonical Core guardian skill definitions grouped by their GW2 owner. */
import { BOON, COMBO_FIELD, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_WEAPONS_MACE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.TRUE_STRIKE]: {
    name: 'True Strike',
    description: 'Chain. Smash your foe.',
    icon: 'https://render.guildwars2.com/file/0F7A60D7249F98413466A1F9F8382002F878B766/103194.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.PURE_STRIKE]: {
    name: 'Pure Strike',
    description: 'Chain. Bash your foe.',
    icon: 'https://render.guildwars2.com/file/69DC2CC8B83C3A096207051F3ECAD96CB3FB75A8/103193.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  },
  [ID.FAITHFUL_STRIKE]: {
    name: 'Faithful Strike',
    description: 'Hit your foe with a final strike and heal nearby allies.',
    icon: 'https://render.guildwars2.com/file/FF96FC6D501276A90FE8C3371167E9D3B2BCE409/103192.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.55,
        hits: 1
      }
    ]
  },
  [ID.SYMBOL_OF_FAITH]: {
    name: 'Symbol of Faith',
    description:
      'Symbol. Smash the ground to heal allies and create a mystic symbol that damages foes and regenerates allies.',
    icon: 'https://render.guildwars2.com/file/27E2E665047EE1BBABD57E65660EF6037FFE38D4/103195.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_2',

    cooldown: 8,
    // Author symbol identity independently of the skill's display text.
    tags: ['symbol'],
    castTimeMs: 520,
    // The Light field begins with the first symbol pulse and lasts through the fifth.
    comboFields: [
      { ownerId: 'guardian', fieldType: COMBO_FIELD.LIGHT, duration: 4, startMs: 760, startAnchor: 'castStart' }
    ],
    effects: [
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        coefficient: 3.25 / 5,
        atMs: 760,
        applications: 5,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      // Regeneration follows the symbol's pulses so mace boon-duration traits affect actual applications.
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        duration: 1,
        stacks: 1,
        applications: 5,
        atMs: 760,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        audience: { recipients: RECIPIENT.PARTY }
      }
    ]
  },
  [ID.PROTECTORS_STRIKE]: {
    name: "Protector's Strike",
    description:
      'Protect allies from the next incoming attack against them, and lash out when attacked, granting boons to nearby allies and fully charging the passive burning effect.',
    icon: 'https://render.guildwars2.com/file/7C42A81ACFBFFE32A528DFCA8014E7C4476358C8/103202.png',
    type: 'Weapon',
    weapon: 'Mace',
    slot: 'Weapon_3',
    cooldown: 15,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      // The modeled counterattack grants its boons alongside the strike.
      { type: 'boon', boon: BOON.PROTECTION, duration: 3, stacks: 1, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.AEGIS, duration: 6, stacks: 1, audience: { recipients: RECIPIENT.PARTY } }
    ]
  }
});
