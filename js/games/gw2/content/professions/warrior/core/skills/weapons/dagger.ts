/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const WARRIOR_WEAPONS_DAGGER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.KEEN_STRIKE]: {
    implemented: true,
    interruptCommitMs: 280,
    quicknessCastTimeMs: 440,
    dualWieldCastTimeMs: 320,
    effects: [
      {
        type: 'strike',
        coefficient: 1.05,
        hits: 1,
        atMs: 280,
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
    implemented: true,
    quicknessCastTimeMs: 360,
    dualWieldCastTimeMs: 240,
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1,
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.PRECISE_CUT]: {
    implemented: true,
    quicknessCastTimeMs: 320,
    dualWieldCastTimeMs: 240,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.WASTRELS_RUIN]: {
    implemented: true,
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
    implemented: true,
    quicknessCastTimeMs: 440,
    dualWieldCastTimeMs: 320,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'daze'
        }
      }
    ]
  },
  [ID.HUSHBLADE]: {
    implemented: true,
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
        metadata: {
          controlKind: 'daze'
        }
      }
    ]
  },
  [ID.AURA_SLICER]: {
    implemented: true,
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
