import { COMBO_FINISHER, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

export const WARRIOR_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SEVER_ARTERY]: {
    dualWieldEffectOffsetsMs: { 200: 160 },
    castTimeMs: 360,
    dualWieldCastTimeMs: 280,
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
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 6
      }
    ])
  },
  [ID.GASH]: {
    dualWieldEffectOffsetsMs: { 280: 240 },
    castTimeMs: 520,
    dualWieldCastTimeMs: 360,
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
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 6
      }
    ])
  },
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
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 6
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 1
      }
    ])
  },
  [ID.SAVAGE_LEAP]: {
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    castTimeMs: 1000,
    interruptMode: 'commit',
    // Preserve the landing effects once the leap commits, even if the cast is interrupted.
    interruptCommitMs: 960,
    // Retain a field crossed during the leap even when it expires before landing.
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.LEAP,
        fieldSelectionAnchor: 'castStart'
      }
    ],
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
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 3
        },
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          stacks: 3,
          duration: 5
        }
      ]
    )
  },
  [ID.REND]: {
    dualWieldEffectOffsetsMs: { 440: 320 },
    castTimeMs: 960,
    dualWieldCastTimeMs: 720,
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
        ticks: [{ atMs: 440, condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 2 }]
      },
      {
        type: 'condition',
        atMs: -80,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        condition: CONDITION.BLEEDING,
        stacks: 6,
        duration: 6
      }
    ])
  },
  [ID.IMPALE]: {
    // Use the reviewed cast durations, with the shorter recovery selected by Dual Wielding.
    castTimeMs: 440,
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
        condition: CONDITION.TORMENT,
        stacks: 5,
        duration: 8
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 1,
        applications: 5,
        atMs: 0,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]),
    // Expose Rip for the embedded sword's lifetime, independently of Impale's recharge.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.RIP, durationSec: 4 } }]
  },
  [ID.RIP]: {
    dualWieldEffectOffsetsMs: { 440: 320 },
    castTimeMs: 680,
    dualWieldCastTimeMs: 420,
    // Rip's impact is measured separately from its user-selected cast duration.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 5,
        stacks: 10
      }
    ]),
    // Accepting the follow-up restores Impale's tile even when Rip is subsequently canceled.
    sideEffects: [{ on: 'castStart', do: { type: 'flipConsume', skillId: ID.RIP } }]
  },
  [ID.RIPOSTE]: {
    castTimeMs: 2400,
    // Release the block early by default so its follow-up can be selected within the original channel window.
    defaultInterruptMs: 200,
    interruptCommitMs: 80,
    effects: [],
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime, cast) => runtime.time < cast.fullEnd,
        do: { type: 'warrior.riposte-arm' }
      }
    ]
  },
  [ID.ADRENALINE_RUSH]: {
    // Adrenaline Rush instantly grants its resource without striking the target.
    castTimeMs: 0,
    effects: [],
    sideEffects: [
      { on: 'castStart', do: { type: 'flipConsume', skillId: ID.ADRENALINE_RUSH } },
      { on: 'castCommit', do: { type: 'warrior.grant-combat-resource', amount: 3 } }
    ]
  }
});

/** Riposte arms its follow-up for the block window; Core Warrior admission enforces every weapon follow-up window. */
export const swordFlipLifecycle: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  sideEffectHandlers: {
    'warrior.riposte-arm'(runtime, context) {
      if (context.kind === 'cast') runtime.armFlip(ID.ADRENALINE_RUSH, { expiresAt: context.cast.fullEnd });
    }
  }
};
