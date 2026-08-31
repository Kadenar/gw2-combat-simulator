/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_WEAPONS_LONGBOW_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DEFLECTING_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        atMs: -80,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        atMs: -80,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
  },
  [ID.SYMBOL_OF_ENERGY]: {
    implemented: true,
    quicknessCastTimeMs: 400,
    effects: [
      {
        type: 'strike',
        coefficient: 1.38,
        hits: 1,
        name: 'Symbol of Energy — Initial Damage'
      },
      {
        type: 'strike',
        coefficient: 2.07,
        hits: 4,
        atMs: 1000,
        intervalMs: 1000,
        name: 'Symbol of Energy — Symbol Damage',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 12
      }
    ]
  },
  [ID.TRUE_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    effects: [
      {
        type: 'strike',
        coefficient: 2.8,
        hits: 1
      }
    ]
  },
  [ID.PUNCTURE_SHOT]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: -160,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HUNTERS_WARD]: {
    implemented: true,
    quicknessCastTimeMs: 720,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 3,
        atMs: -100,
        intervalMs: 520,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: "Hunter's Ward — Arrow Damage"
      },
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        atMs: 1460,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: "Hunter's Ward — Final Impact Damage"
      }
    ]
  }
});
