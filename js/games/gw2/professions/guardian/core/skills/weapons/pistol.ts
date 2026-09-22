/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const GUARDIAN_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.JURISDICTION]: {
    castTimeMs: 800,
    interruptCommitMs: 640,
    cooldown: 20,
    // Keep the projectile's strike, Burning, and stun on one committed impact.
    effects: impactEffects(
      { atMs: 640, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 3,
          projectile: true
        },
        {
          type: 'condition',
          condition: 'Burning',
          stacks: 5,
          duration: 6
        },
        {
          type: 'control',
          controlKind: 'stun'
        }
      ]
    )
  },
  [ID.HAIL_OF_JUSTICE]: {
    castTimeMs: 1120,
    // Cancelling the channel keeps landed hits and their conditions, while dropping later packets.
    interruptMode: 'per-packet',
    cooldown: 10,
    ammo: 2,
    ammoRecharge: 10,
    ammoCastLockout: 1,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [280, 440, 640, 800, 960].map((atMs) => ({
          atMs,
          coefficient: 0.3,
          projectile: true
        }))
      },
      {
        type: 'condition',
        ticks: [280, 440, 640, 800, 960].map((atMs) => ({
          atMs,
          condition: 'Bleeding',
          stacks: 1,
          duration: 8,
          projectile: true
        }))
      },
      {
        type: 'condition',
        ticks: [280, 440, 640, 800, 960].map((atMs) => ({
          atMs,
          condition: 'Crippled',
          stacks: 1,
          duration: 1,
          projectile: true
        }))
      }
    ])
  },
  [ID.PEACEKEEPER]: {
    // EVTC impact offsets keep Burning aligned with each strike.
    castTimeMs: 1040,
    interruptCommitMs: 960,
    cooldown: 6,
    rechargeAnchor: 'castStart',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [280, 480, 640, 800, 960].map((atMs) => ({
          atMs,
          coefficient: 0.25
        }))
      },
      // Each strike applies the same Burning packet at its impact time.
      ...[280, 480, 640, 800, 960].map((atMs) => ({
        type: 'condition' as const,
        ticks: [{ atMs, condition: 'Burning', stacks: 1, duration: 1.5 }]
      }))
    ])
  },
  [ID.SYMBOL_OF_IGNITION]: {
    castTimeMs: 360,
    interruptCommitMs: 320,
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: 'Light',
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [280, 960, 1640, 2320, 3000].map((atMs) => ({
          atMs,
          coefficient: 0.4
        }))
      },
      ...[280, 960, 1640, 2320, 3000].map((atMs) => ({
        type: 'boon' as const,
        boon: 'might',
        stacks: 1,
        duration: 5,
        audience: { recipients: 'party' as const },
        atMs
      }))
    ])
  },
  [ID.THROUGH_THE_HEART]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    interruptCommitMs: 360,
    // Keep the projectile strike and Bleeding on one committed impact.
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.6,
          projectile: true
        },
        {
          type: 'condition',
          condition: 'Bleeding',
          stacks: 1,
          duration: 8,
          projectile: true
        }
      ]
    )
  }
});
