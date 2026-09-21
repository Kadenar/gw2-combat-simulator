/**
 * Owns Luminary stance and stance-chain skill fragments.
 * Persistent stance windows and scheduled effects remain in `mechanics/stances.ts`.
 */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Cast-scaled impacts use the measured Quickness timeline as their source data.
export const PIERCING_STANCE_IMPACT_MS = 160;

export const LUMINARY_STANCE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RESOLUTE_STANCE]: {
    castTimeMs: 680,
    effects: []
  },
  [ID.DARING_ADVANCE]: {
    castTimeMs: 1000,

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
            // The leap can combo with an existing field, but not the field this cast creates.
            excludeOwnField: true,
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
    castTimeMs: 200,
    // Keep the stance's strike and daze on one impact.
    effects: impactEffects({ atMs: PIERCING_STANCE_IMPACT_MS, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ])
  },
  [ID.VALOROUS_STANCE]: {
    // This non-DPS stance has simulated boons; hide it from loadout slots without blocking recorded casts.
    simulatorExcluded: false,
    slotSelectable: false,
    castTimeMs: 200,
    // Activation grants the stance's defensive boons to nearby allies.
    effects: [
      { type: 'boon', boon: 'stability', stacks: 5, duration: 4, audience: { recipients: 'party' } },
      { type: 'boon', boon: 'protection', duration: 4, audience: { recipients: 'party' } }
    ]
  }
});
