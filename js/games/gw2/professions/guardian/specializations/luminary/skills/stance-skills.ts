/**
 * Owns Luminary stance and stance-chain skill fragments.
 * Persistent stance windows and scheduled effects remain in `mechanics/stances.ts`.
 */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Cast-scaled impacts use the measured Quickness timeline as their source data.
export const PIERCING_STANCE_IMPACT_MS = 160;

export const LUMINARY_STANCE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RESOLUTE_STANCE]: {
    castTimeMs: 1000,
    effects: []
  },
  [ID.DARING_ADVANCE]: {
    castTimeMs: 1000,
    unaffectedByQuickness: true,
    effects: [
      {
        type: 'strike',
        // The strike and target tether land about 680 ms into the fixed animation;
        // this also anchors its damage buff, Light field, and leap finisher.
        ticks: [{ atMs: 680, coefficient: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFields: [{ ownerId: 'guardian', fieldType: 'Light', duration: 5 }],
        comboFinishers: [
          {
            ownerId: 'guardian',
            finisherType: 'Leap',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    ]
  },
  [ID.EFFULGENT_STANCE]: {
    castTimeMs: 0,
    effects: []
  },
  [ID.PIERCING_STANCE]: {
    quicknessCastTimeMs: 200,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: PIERCING_STANCE_IMPACT_MS, coefficient: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: PIERCING_STANCE_IMPACT_MS,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'daze',
        duration: 0.5
      }
    ]
  },
  [ID.VALOROUS_STANCE]: {
    castTimeMs: 250,
    effects: []
  },
  [ID.STALWART_STANCE]: {
    castTimeMs: 250,
    effects: [
      {
        type: 'control',
        controlKind: 'control'
      }
    ]
  }
});
