/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { COMBO_FIELD, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

// Packet offsets are the canonical Quickness timings measured from EVTC animation starts.
export const GUARDIAN_WEAPONS_LONGBOW_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.PUNCTURE_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 680,
    // The shot has committed by its observed impact; cancelling the remaining animation preserves the projectile.
    interruptCommitMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 560, coefficient: 1 }],
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.TRUE_SHOT]: {
    castTimeMs: 680,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 680, coefficient: 2.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DEFLECTING_SHOT]: {
    castTimeMs: 600,
    // Keep the shot's strike and control on one impact.
    effects: impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.8
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKBACK
      }
    ])
  },
  [ID.SYMBOL_OF_ENERGY]: {
    // Author symbol identity independently of the skill's display text.
    tags: ['symbol'],
    castTimeMs: 400,
    // The symbol creates its four-second Light field with the initial impact.
    comboFields: [{ ownerId: 'guardian', fieldType: COMBO_FIELD.LIGHT, duration: 4, startAnchor: 'castEnd' }],
    effects: [
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        coefficient: 1.38,
        hits: 1,
        name: 'Symbol of Energy — Initial Damage'
      },
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        coefficient: 2.07 / 4,
        atMs: 1000,
        applications: 4,
        intervalMs: 1000,
        name: 'Symbol of Energy — Symbol Damage',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 12
      }
    ]
  },
  [ID.HUNTERS_WARD]: {
    castTimeMs: 720,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 680, coefficient: 0.75 },
          { atMs: 1200, coefficient: 0.75 },
          { atMs: 1720, coefficient: 0.75 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: "Hunter's Ward — Arrow Damage"
      },
      {
        type: 'strike',
        ticks: [{ atMs: 2240, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: "Hunter's Ward — Final Impact Damage"
      }
    ]
  }
});
