/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { impactEffects, strikeTimeline } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const GUARDIAN_WEAPONS_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.LEAP_OF_FAITH]: {
    castTimeMs: 720,
    // Cancelling at or after 680 ms preserves the landing strike and blind.
    interruptCommitMs: 680,
    // Keep the landing strike and blind together, 80 ms before the animation ends.
    effects: impactEffects(
      {
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      [
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
    )
  },
  [ID.WHIRLING_WRATH]: {
    interruptMode: 'per-packet',
    // Store the measured effective action duration directly.
    castTimeMs: 1480,
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
    castTimeMs: 400,
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
    castTimeMs: 600,
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
    castTimeMs: 680,
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
    // Author symbol identity independently of the skill's display text.
    tags: ['symbol'],
    castTimeMs: 320,
    defaultInterruptMs: 280,

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
      // Self Resolution follows each pulse even when the symbol misses.
      ...[200, 1200, 2200, 3200, 4200].map((atMs) => ({
        type: 'boon' as const,
        boon: 'resolution',
        duration: 1,
        stacks: 1,
        atMs,
        timingAnchor: 'castStart' as const,
        timingScale: 'fixed' as const,
        persistsAfterInterrupt: atMs !== 200
      })),
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        ticks: [{ atMs: 200, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Symbol of Resolution — Initial'
      },
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        ticks: Array.from({ length: 4 }, (_, index) => ({ atMs: 1200 + index * 1000, coefficient: 2.6 / 4 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        name: 'Symbol of Resolution'
      }
    ]
  },
  [ID.BINDING_BLADE]: {
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.PULL, expiryPriority: -220 } }],
    castTimeMs: 480,
    // Pull Self stays available for the tether's lifetime.
    flipDuration: 10,
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
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.PULL } }],
    castTimeMs: 520,
    // Binding Blade only tethers; its armed Pull flip owns the control event that can trigger control relics.
    effects: [
      {
        type: 'control',
        controlKind: 'control'
      }
    ]
  }
});
