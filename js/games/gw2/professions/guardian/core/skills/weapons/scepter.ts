/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { BOON, COMBO_FIELD, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.ORB_OF_WRATH]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
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
