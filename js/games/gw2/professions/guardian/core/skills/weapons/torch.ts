import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { radiantFireDurationMultiplier } from '#gw2/professions/guardian/core/traits/behavior.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Canonical Core guardian skill fragments grouped by their GW2 owner. */

export const GUARDIAN_WEAPONS_TORCH_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.CLEANSING_FLAME]: {
    interruptMode: 'per-packet',
    // Store the measured effective action duration directly.
    castTimeMs: 2600,
    // Match the reference hit offsets, with Burning applied on the final strike.
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [280, 520, 760, 1000, 1240, 1480, 1720, 1960, 2200, 2520].map((atMs) => ({ atMs, coefficient: 4 / 10 }))
      },
      {
        type: 'condition',
        ticks: [{ atMs: 2520, condition: 'Burning', stacks: 2, duration: 4 }]
      }
    ])
  },
  [ID.ZEALOTS_FIRE]: {
    // Consume once before blocking immediate Flame reuse.
    sideEffects: [
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.ZEALOTS_FIRE } },
      { on: 'castCommit', do: { type: 'guardian.zealots-fire-lockout' } }
    ],
    castTimeMs: 680,
    interruptCommitMs: 480,
    cooldown: 0,
    // Keep the thrown flame's strike and Burning on one impact.
    effects: impactEffects(
      { atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          // The thrown flame uses the projectile ignition cooldown.
          coefficient: 2.25,
          projectile: true
        },
        {
          type: 'condition',
          condition: 'Burning',
          stacks: 3,
          duration: 3
        }
      ]
    )
  },
  [ID.ZEALOTS_FLAME]: {
    // The selected trait extends this activation's follow-up window.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.arm-zealots-fire' } }],
    // Zealot's Fire stays available while the flame burns; Radiant Fire lengthens it.
    flipDuration: 3,
    // Fire sets this lockout; another actual skill clears it at commitment.
    lockouts: [{ group: 'guardian-zealots-flame-after-fire', durationMs: 400 }],
    castTimeMs: 0,
    cooldown: 15,
    ammo: 1,
    ammoRecharge: 15,
    ammoCastLockout: 0,
    effects: [
      {
        type: 'condition',
        ticks: Array.from({ length: 4 }, (_, index) => ({
          atMs: 0 + index * 1000,
          condition: 'Burning',
          stacks: 1,
          duration: 3
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});

/** Torch activation owns its flip duration and lockout; later eligible skills clear the shared lockout. */
export const guardianTorchActions: RuntimeProfession<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers'] = {
  'guardian.arm-zealots-fire'(runtime, context) {
    const duration = Number(context.skill.flipDuration) * radiantFireDurationMultiplier(runtime);
    runtime.armFlip(ID.ZEALOTS_FIRE, { expiresAt: canonicalTime(runtime.time + duration), expiryPriority: -220 });
  },
  'guardian.zealots-fire-lockout'(runtime) {
    for (const lockout of runtime.helpers.skillsById.get(ID.ZEALOTS_FLAME)?.lockouts ?? [])
      runtime.castController.setLockout(lockout.group, canonicalTime(runtime.time + lockout.durationMs / 1000));
  }
};
