/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const WARRIOR_WEAPONS_DAGGER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.KEEN_STRIKE]: {
    interruptCommitMs: 280,
    quicknessCastTimeMs: 440,
    dualWieldCastTimeMs: 320,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 1.05 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 1,
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.FOCUSED_SLASH]: {
    quicknessCastTimeMs: 360,
    dualWieldCastTimeMs: 240,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.65 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.PRECISE_CUT]: {
    quicknessCastTimeMs: 320,
    dualWieldCastTimeMs: 240,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.WASTRELS_RUIN]: {
    cooldown: 12,
    quicknessCastTimeMs: 400,
    dualWieldCastTimeMs: 320,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  },
  [ID.DISRUPTING_STAB]: {
    quicknessCastTimeMs: 440,
    dualWieldCastTimeMs: 320,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 160, coefficient: 1.2 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'daze'
      }
    ]
  },
  [ID.HUSHBLADE]: {
    ammo: 2,
    ammoRecharge: 12,
    cooldown: 12,
    ammoCastLockout: 1,
    quicknessCastTimeMs: 500,
    dualWieldCastTimeMs: 400,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ]
  },
  [ID.AURA_SLICER]: {
    castTimeMs: 750,
    unaffectedByQuickness: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 1.5
      }
    ]
  }
});
