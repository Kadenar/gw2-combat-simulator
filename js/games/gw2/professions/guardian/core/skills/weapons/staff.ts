/** Canonical Core guardian skill definitions grouped by their GW2 owner. */
import { COMBO_FIELD } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  // Catalog chain links let the shared autoattack controller own progression, availability, and resets.
  [ID.BOLT_OF_WRATH]: {
    name: 'Bolt of Wrath',
    icon: 'https://render.guildwars2.com/file/4F6B5A087DA754B44DAC062EDD57E719E3CC92B4/2029302.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1
      }
    ]
  },
  [ID.SEEKING_JUDGMENT]: {
    name: 'Seeking Judgment',
    icon: 'https://render.guildwars2.com/file/F7F7100DB608A7CBFA3EFB6918D992287E30DB14/2029304.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1
      }
    ]
  },
  [ID.SEARING_LIGHT]: {
    name: 'Searing Light',
    icon: 'https://render.guildwars2.com/file/786A40D25853070BFE4936656A03679DC21239AC/2029303.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1
      }
    ]
  },
  [ID.HOLY_STRIKE]: {
    name: 'Holy Strike',
    icon: 'https://render.guildwars2.com/file/E693B0D94525BFECFDB6FAC2670A1360443DB2F0/2029305.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_2',
    cooldown: 8,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1
      }
    ]
  },
  [ID.SYMBOL_OF_SWIFTNESS]: {
    name: 'Symbol of Swiftness',
    icon: 'https://render.guildwars2.com/file/E315FF56624F5B2BB8BF51D00FA716FA4936F037/103268.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_3',

    cooldown: 12,
    // Author symbol identity independently of the skill's display text.
    tags: ['symbol'],
    castTimeMs: 520,
    // The symbol creates its four-second Light field when the cast completes.
    comboFields: [{ ownerId: 'guardian', fieldType: COMBO_FIELD.LIGHT, duration: 4, startAnchor: 'castEnd' }],
    effects: [
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        // The symbol pulses on placement and each second through its field, like the other four-second symbols.
        coefficient: 2.5 / 5,
        atMs: 0,
        applications: 5,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.EMPOWER]: {
    name: 'Empower',
    icon: 'https://render.guildwars2.com/file/0EFCC1FD452CC19694D6BA3F390C1822C3FE73CD/103636.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_4',
    cooldown: 20,
    castTimeMs: 520,
    effects: []
  },
  [ID.LINE_OF_WARDING]: {
    name: 'Line of Warding',
    icon: 'https://render.guildwars2.com/file/62F8F469B1AEF1C440AAAB010B7268C2C32F364D/103658.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_5',

    cooldown: 30,
    castTimeMs: 520,
    effects: []
  }
};
