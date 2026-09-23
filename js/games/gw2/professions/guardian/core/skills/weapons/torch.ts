/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

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
        ticks: [
          // Apply each Burning stack separately so same-impact relic checks observe every application.
          ...Array.from({ length: 2 }, () => ({ atMs: 2520, condition: 'Burning' as const, stacks: 1, duration: 4 }))
        ]
      }
    ])
  },
  [ID.ZEALOTS_FIRE]: {
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
        // Apply each Burning stack separately so same-impact relic checks observe every application.
        ...Array.from({ length: 3 }, () => ({
          type: 'condition' as const,
          condition: 'Burning' as const,
          stacks: 1,
          duration: 3
        }))
      ]
    )
  },
  [ID.ZEALOTS_FLAME]: {
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
