import { COMBO_FIELD, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const GUARDIAN_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SWORD_OF_WRATH]: {
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
});
