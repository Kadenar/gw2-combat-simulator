/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { strikeTimeline } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const GUARDIAN_WEAPONS_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.LEAP_OF_FAITH]: {
    quicknessCastTimeMs: 720,
    // Cancelling at or after 680 ms preserves the landing strike and blind.
    interruptCommitMs: 680,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        // The normal landing impact precedes the end of the animation by 80 ms.
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true,
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
        duration: 3,
        // Blind applies with the landing hit, rather than after the remaining animation.
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.WHIRLING_WRATH]: {
    interruptMode: 'per-packet',
    // The catalog derives the unquickened cast from this measured Quickness duration.
    quicknessCastTimeMs: 1480,
    // ponytail: land both hits at projectile arrival so cancellation uses one boundary per pair;
    // restore separate launch timing only if the 40 ms melee lead needs to be modeled.
    effects: [
      strikeTimeline(
        Array.from({ length: 7 }, (_, index) => [
          { atMs: 480 + index * 160, coefficient: 0.35 },
          { atMs: 480 + index * 160, projectile: true, coefficient: 0.275 }
        ]).flat(),
        {
          timingAnchor: 'castStart',
          timingScale: 'cast'
        }
      )
    ]
  },
  [ID.GREAT_SWORD_STRIKE]: {
    castTimeMs: 600,
    // A committed cancel advances the chain and preserves the pending hit at its normal impact time.
    interruptCommitMs: 320,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1 }],
        persistsAfterInterrupt: true,
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
    // Damage lands at 440 ms; the 480 ms safe cancel still keeps the full
    // 680 ms Quickness action lane occupied.
    interruptCommitMs: 480,
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
        // Keep the tether's damage separate from the initial strike in the combat breakdown.
        damageBreakdownName: 'Binding Blade — Tether',
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
