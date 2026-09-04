/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { strikeTimeline } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const GUARDIAN_WEAPONS_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.LEAP_OF_FAITH]: {
    quicknessCastTimeMs: 720,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        // Leap of Faith only creates combo effects when this packet resolves through an active field.
        comboFinishers: [
          {
            ownerId: 'guardian',
            finisherType: 'Leap',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'blind',
        duration: 3
      }
    ]
  },
  [ID.WHIRLING_WRATH]: {
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
    castTimeMs: 600,
    // Strike has no cancellable tail: its packet commits on the 400 ms
    // Quickness action boundary.
    interruptCommitMs: 400,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.GREAT_SWORD_VENGEFUL_STRIKE]: {
    quicknessCastTimeMs: 600,
    // The packet commits at 400 ms, but cancelling there retains the full
    // 600 ms action lockout observed in the combat log.
    interruptCommitMs: 400,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1.1 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.GREAT_SWORD_WRATHFUL_STRIKE]: {
    castTimeMs: 1000,
    // Damage lands at 440 ms; the 520 ms safe cancel still keeps the full
    // 680 ms Quickness action lane occupied.
    interruptCommitMs: 520,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.SYMBOL_OF_RESOLUTION]: {
    castTimeMs: 320,
    unaffectedByQuickness: true,
    // The symbol commits at 240 ms but may occupy the action lane through 320 ms, so imported tick timings
    // between those bounds are safe interrupts and the committed symbol keeps pulsing afterward.
    interruptCommitMs: 240,
    rechargeAnchor: 'castStart',
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: 'Light',
        duration: 4,
        startMs: 200,
        startAnchor: 'castStart',
        // The final pulse can share a server timestamp with a successful finisher, so keep that boundary eligible.
        inclusiveExpiry: true
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 200, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Symbol of Resolution — Initial'
      },
      {
        type: 'strike',
        ticks: Array.from({ length: 4 }, (_, index) => ({ atMs: 1200 + index * 1000, coefficient: 2.6 / 4 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        name: 'Symbol of Resolution'
      }
    ]
  },
  [ID.BINDING_BLADE]: {
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: Array.from({ length: 10 }, (_, index) => ({ atMs: 1000 + index * 1000, coefficient: 0 / 10 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Binding Blade — Tether',
        canCrit: false,
        sourceId: 9148,
        // Tether pulses are non-critical power strikes, so they remain in strike totals.
        flatStrikeBase: 160,
        flatStrikePowerCoeff: 0.3
      }
    ]
  },
  [ID.PULL]: {
    castTimeMs: 750,
    // Binding Blade only tethers; its armed Pull flip owns the control event that can trigger control relics.
    effects: [
      {
        type: 'control',
        controlKind: 'control'
      }
    ]
  }
});
