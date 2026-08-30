/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import { strikeTimeline } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_WEAPONS_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.LEAP_OF_FAITH]: {
    implemented: true,
    quicknessCastTimeMs: 720,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'blind'
      }
    ]
  },
  [ID.WHIRLING_WRATH]: {
    implemented: true,
    interruptMode: 'per-packet',
    // The catalog derives the unquickened cast from this measured Quickness duration.
    quicknessCastTimeMs: 1480,
    effects: [
      strikeTimeline(
        [
          // Packet offsets use nearest-millisecond timing instead of retaining fractional interpolation artifacts.
          { atMs: 106, coefficient: 0.35 },
          { atMs: 211, coefficient: 0.275 },
          { atMs: 317, coefficient: 0.35 },
          { atMs: 422, coefficient: 0.275 },
          { atMs: 528, coefficient: 0.35 },
          { atMs: 634, coefficient: 0.275 },
          { atMs: 739, coefficient: 0.35 },
          { atMs: 846, coefficient: 0.275 },
          { atMs: 951, coefficient: 0.35 },
          { atMs: 1057, coefficient: 0.275 },
          { atMs: 1162, coefficient: 0.35 },
          { atMs: 1268, coefficient: 0.275 },
          { atMs: 1374, coefficient: 0.35 },
          { atMs: 1480, coefficient: 0.275 }
        ],
        {
          timingAnchor: 'castStart',
          timingScale: 'cast'
        }
      )
    ]
  },
  [ID.GREAT_SWORD_STRIKE]: {
    implemented: true,
    castTimeMs: 600,
    // Strike has no cancellable tail: its packet commits on the 400 ms
    // Quickness action boundary.
    interruptCommitMs: 400,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.GREAT_SWORD_VENGEFUL_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    // The packet commits at 400 ms, but cancelling there retains the full
    // 600 ms action lockout observed in the combat log.
    paletteInterruptMs: 400,
    interruptCommitMs: 400,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.GREAT_SWORD_WRATHFUL_STRIKE]: {
    implemented: true,
    castTimeMs: 1000,
    // Damage lands at 440 ms; the 520 ms safe cancel still keeps the full
    // 680 ms Quickness action lane occupied.
    paletteInterruptMs: 520,
    interruptCommitMs: 520,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.SYMBOL_OF_RESOLUTION]: {
    implemented: true,
    castTimeMs: 280,
    unaffectedByQuickness: true,
    // EVTC places the initial impact ~200 ms after activation and shows recharge
    // progressing from activation while the remaining symbol pulses continue.
    rechargeAnchor: 'castStart',
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        atMs: 200,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Symbol of Resolution — Initial'
      },
      {
        type: 'strike',
        coefficient: 2.6,
        hits: 4,
        atMs: 1200,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Symbol of Resolution'
      }
    ]
  },
  [ID.BINDING_BLADE]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 10,
        atMs: 1000,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Binding Blade — Tether',
        canCrit: false,
        sourceId: 9148,
        metadata: {
          flatStrikeBase: 160,
          flatStrikePowerCoeff: 0.3,
          damageKind: 'condition'
        }
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
  },
  [ID.PULL]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
  }
});
