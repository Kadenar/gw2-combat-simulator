/** Canonical Core guardian skill definitions grouped by their GW2 owner. */
import { BOON, COMBO_FIELD, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.ORB_OF_WRATH]: {
    name: 'Orb of Wrath',
    description: 'Fire a slow-moving orb at your foe.',
    icon: 'https://render.guildwars2.com/file/0F9DAB04690C9A01C80DEEE8D5792937F4EF6DC4/103642.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 440,
    interruptCommitMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.SYMBOL_OF_PUNISHMENT]: {
    name: 'Symbol of Punishment',
    description: 'Symbol. Create a symbol on the ground that strikes foes and grants might to nearby allies.',
    icon: 'https://render.guildwars2.com/file/C3DB032B0C51CD2DC9EC01CFB1DFA406466D3B0E/103263.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_2',

    // Author symbol identity independently of the skill's display text.
    tags: ['symbol'],
    cooldown: 10,
    castTimeMs: 320,
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: COMBO_FIELD.LIGHT,
        duration: 4,
        startMs: 240,
        startAnchor: 'castStart'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        // Smite strikes random spots in the symbol, so some opportunities miss. Seven of eight landed in every logged
        // cast; Writ's larger symbol makes later hits unreliable, so this calibrated timeline is not extended.
        ticks: [240, 760, 1240, 1760, 2760, 3240, 3760].map((atMs) => ({
          atMs,
          coefficient: 0.2
        }))
      },
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        // Main symbol damage begins one second after the initial boon pulse and lands once per second.
        coefficient: 0.5,
        atMs: 1240,
        applications: 4,
        intervalMs: 1000
      },
      // Each symbol pulse grants party Might, beginning with placement.
      {
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 4,
        duration: 5,
        audience: { recipients: RECIPIENT.PARTY },
        atMs: 240,
        applications: 5,
        intervalMs: 1000
      }
    ])
  },
  [ID.CHAINS_OF_LIGHT]: {
    name: 'Chains of Light',
    description: 'Immobilize and make your foe vulnerable with ethereal chains.',
    icon: 'https://render.guildwars2.com/file/43B33FC616A6FAEFEC2AA2A5C50A4F93A4A5317A/103292.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_3',
    cooldown: 15,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1
      },
      {
        // Chains of Light applies a duration condition, not a hard disable (wiki: Chains_of_Light).
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 5
      },
      {
        // Keep the vulnerability application and generated tooltip on the same skill payload.
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 6
      }
    ]
  }
});
