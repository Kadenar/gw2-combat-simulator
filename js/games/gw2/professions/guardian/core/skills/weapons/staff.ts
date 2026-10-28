/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { COMBO_FIELD } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.BOLT_OF_WRATH]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1
      }
    ],
    // Preserve the existing staff-chain follow-up window through an explicit declaration.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.arm-follow-up' } }]
  },
  [ID.SEEKING_JUDGMENT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1
      }
    ],
    // The final chain strike consumes only its own follow-up.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.SEEKING_JUDGMENT } }]
  },
  [ID.SEARING_LIGHT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1
      }
    ],
    // Preserve the existing staff-chain follow-up window through an explicit declaration.
    sideEffects: [
      { on: 'castCommit', do: { type: 'guardian.arm-follow-up' } },
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.SEARING_LIGHT } }
    ]
  },
  [ID.HOLY_STRIKE]: {
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
    castTimeMs: 520,
    effects: []
  },
  [ID.LINE_OF_WARDING]: {
    castTimeMs: 520,
    effects: []
  }
});
