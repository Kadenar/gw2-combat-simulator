/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const WARRIOR_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.HAMSTRING]: {
    castTimeMs: 400,
    dualWieldCastTimeMs: 320,
    // Dual Wielding advances the slash's commit point when its offhand requirement is met.
    interruptCommitMs: 320,
    dualWieldInterruptCommitMs: 200,
    // The slash and its conditions precede full recovery by 160 ms at either attack speed.
    effects: impactEffects({ atMs: -160, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.2
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 1
      }
    ])
  },
  [ID.SEVER_ARTERY]: {
    castTimeMs: 360,
    dualWieldCastTimeMs: 280,
    dualWieldEffectOffsetsMs: { 200: 160 },
    // Require the slash to commit before an interrupted cast can deal damage.
    interruptCommitMs: 320,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.8
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6
      }
    ])
  },
  [ID.GASH]: {
    castTimeMs: 520,
    dualWieldCastTimeMs: 360,
    dualWieldEffectOffsetsMs: { 280: 240 },
    interruptCommitMs: 360,
    retainsCastLockoutAfterInterrupt: true,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.8
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6
      }
    ])
  },
  [ID.SAVAGE_LEAP]: {
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    // Retain a field crossed during the leap even when it expires before landing.
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Leap',
        fieldSelectionAnchor: 'castStart',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    castTimeMs: 1000,
    // Preserve the landing effects once the leap commits, even if the cast is interrupted.
    interruptCommitMs: 960,
    interruptMode: 'commit',
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 2
        },
        {
          type: 'condition',
          condition: 'Crippled',
          stacks: 1,
          duration: 3
        },
        {
          type: 'condition',
          condition: 'Bleeding',
          stacks: 3,
          duration: 5
        }
      ]
    )
  },
  [ID.RIPOSTE]: {
    castTimeMs: 2400,
    effects: []
  },
  [ID.IMPALE]: {
    castTimeMs: 420,
    dualWieldCastTimeMs: 360,
    // The projectile and its immediate payload precede full recovery; later cripple pulses retain their own schedule.
    effects: impactEffects({ atMs: -40, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 5,
        duration: 8
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 1,
        applications: 5,
        atMs: 0,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ])
  },
  [ID.RIP]: {
    castTimeMs: 680,
    dualWieldCastTimeMs: 420,
    dualWieldEffectOffsetsMs: { 440: 320 },
    // Rip's impact is measured separately from its user-selected cast duration.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 10
      }
    ])
  },
  [ID.ADRENALINE_RUSH]: {
    // Adrenaline Rush instantly grants its resource without striking the target.
    castTimeMs: 0,
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.grant-combat-resource', amount: 3 } }],
    effects: []
  },
  [ID.REND]: {
    castTimeMs: 960,
    dualWieldCastTimeMs: 720,
    dualWieldEffectOffsetsMs: { 440: 320 },
    // Interrupted replay keeps every Rend packet after its two-part attack commits.
    interruptCommitMs: 920,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 0.5 }]
      },
      {
        type: 'strike',
        // The follow-up retains 80 ms of recovery with either attack speed, preserving its buff-expiry ordering.
        atMs: -80,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        coefficient: 2.5,
        name: 'Rend — Follow-Up Damage'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Immobilized', stacks: 1, duration: 2 }]
      },
      {
        type: 'condition',
        atMs: -80,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        condition: 'Bleeding',
        stacks: 6,
        duration: 6
      }
    ])
  }
});
