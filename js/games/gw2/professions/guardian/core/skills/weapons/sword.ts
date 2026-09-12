/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const GUARDIAN_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SYMBOL_OF_BLADES]: {
    quicknessCastTimeMs: 560,
    // The symbol is placed before the animation ends and continues pulsing after a committed cancel.
    interruptCommitMs: 320,
    // The Light field begins with the first symbol pulse and lasts through the fifth.
    comboFields: [{ ownerId: 'guardian', fieldType: 'Light', duration: 4, startMs: 320, startAnchor: 'castStart' }],
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 320 + index * 1000, coefficient: 3.25 / 5 })),
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'blind'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.SWORD_OF_WRATH]: {
    quicknessCastTimeMs: 360,
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
    quicknessCastTimeMs: 520,
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
  [ID.ZEALOTS_DEFENSE]: {
    quicknessCastTimeMs: 1400,
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
  [ID.SWORD_WAVE]: {
    quicknessCastTimeMs: 680,
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
  [ID.EXECUTIONERS_CALLING]: {
    // The initial slash and dual strike occupy one cast, with damage on each segment's impact.
    quicknessCastTimeMs: 1040,
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
    quicknessCastTimeMs: 520,
    // The dash lands two strikes before its recovery ends.
    effects: [
      {
        type: 'strike',
        ticks: [320, 360].map((atMs) => ({ atMs, coefficient: 1.75 })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  }
});
