import { GUARDIAN_SKILL_IDS as ID } from '../../../data/ids.js';
import type { SkillFragment } from '../../../../../../platform/engine/types.js';

// Cast-scaled impacts use the measured Quickness timeline as their source data.
export const PIERCING_STANCE_IMPACT_MS = 160;

export const LUMINARY_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.EXIT_RADIANT_FORGE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.radiant-forge',
    effects: []
  },
  [ID.RESOLUTE_STANCE]: {
    implemented: true,
    castTimeMs: 1000,
    effects: []
  },
  [ID.DARING_ADVANCE]: {
    implemented: true,
    castTimeMs: 1000,
    unaffectedByQuickness: true,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      }
    ]
  },
  [ID.LUMINOUS_STAFF]: {
    implemented: true,
    quicknessCastTimeMs: 560,
    handlerId: 'guardian.radiant-weapon',
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 4,
        atMs: 440,
        intervalMs: 1000,
        name: 'Luminous Staff — Symbol Damage',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        intervalTimingScale: 'fixed'
      }
    ]
  },
  [ID.EFFULGENT_STANCE]: {
    implemented: true,
    castTimeMs: 0,
    effects: []
  },
  [ID.SHINING_SPIN]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    handlerId: 'guardian.radiant-weapon',
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.GLEAMING_BLADE]: {
    implemented: true,
    quicknessCastTimeMs: 840,
    handlerId: 'guardian.radiant-weapon',
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.BRILLIANT_SLAM]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    handlerId: 'guardian.radiant-weapon',
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      }
    ]
  },
  [ID.GLARING_BURST]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    handlerId: 'guardian.glaring-burst',
    // The replacement strike lands at 480 ms and remains committed when the
    // action lane is released at the observed 520 ms cancel point.
    paletteInterruptMs: 520,
    interruptCommitMs: 520,
    effects: []
  },
  [ID.ENTER_RADIANT_FORGE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.radiant-forge',
    // Entry stays reusable while the forge is active; its final recharge starts on exit.
    mechanicTriggers: [
      {
        type: 'guardian.luminary.clear-forge-entry-cooldown',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
  },
  [ID.PIERCING_STANCE]: {
    implemented: true,
    quicknessCastTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        atMs: PIERCING_STANCE_IMPACT_MS,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: PIERCING_STANCE_IMPACT_MS,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'daze',
          duration: 0.5
        }
      }
    ]
  },
  [ID.RESTORATIVE_GLOW]: {
    implemented: true,
    quicknessCastTimeMs: 560,
    handlerId: 'guardian.radiant-weapon',
    effects: []
  },
  [ID.RADIANT_BULWARK]: {
    implemented: true,
    castTimeMs: 2000,
    handlerId: 'guardian.radiant-weapon',
    effects: []
  },
  [ID.VALOROUS_STANCE]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.STALWART_STANCE]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
  },
  [ID.DAZZLING_HAMMER]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    handlerId: 'guardian.radiant-weapon',
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'daze',
          duration: 2
        }
      }
    ]
  },
  [ID.LUCENT_THRUST]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    handlerId: 'guardian.radiant-weapon',
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        atMs: 480,
        name: 'Lucent Thrust — Projectile Damage',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'control'
        }
      },
      { type: 'blind', atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }
    ]
  },
  [ID.RADIANT_COURAGE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.RADIANT_RESOLVE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.RADIANT_RESOLVE_ID_78604]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.RADIANT_COURAGE_ID_78770]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.RADIANT_JUSTICE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  }
});
