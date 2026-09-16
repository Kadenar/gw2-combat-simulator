/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const GUARDIAN_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.JURISDICTION]: {
    castTimeMs: 800,
    interruptCommitMs: 640,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 640, coefficient: 3, projectile: true }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: 'Burning', stacks: 5, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'control',
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        controlKind: 'stun',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.HAIL_OF_JUSTICE]: {
    castTimeMs: 1120,
    // Cancelling the channel keeps landed hits and their conditions, while dropping later packets.
    interruptMode: 'per-packet',
    cooldown: 10,
    ammo: 2,
    ammoRecharge: 10,
    ammoCastLockout: 1,
    effects: [
      {
        type: 'strike',
        ticks: [280, 440, 640, 800, 960].map((atMs) => ({
          atMs,
          coefficient: 0.3,
          projectile: true
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [280, 440, 640, 800, 960].map((atMs) => ({
          atMs,
          condition: 'Bleeding',
          stacks: 1,
          duration: 8,
          projectile: true
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [280, 440, 640, 800, 960].map((atMs) => ({
          atMs,
          condition: 'Crippled',
          stacks: 1,
          duration: 1,
          projectile: true
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PEACEKEEPER]: {
    // EVTC impact offsets keep Burning aligned with each strike.
    castTimeMs: 1040,
    interruptCommitMs: 960,
    cooldown: 6,
    rechargeAnchor: 'castStart',
    effects: [
      {
        type: 'strike',
        ticks: [280, 480, 640, 800, 960].map((atMs) => ({
          atMs,
          coefficient: 0.25
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      // Each strike applies the same Burning packet at its impact time.
      ...[280, 480, 640, 800, 960].map((atMs) => ({
        type: 'condition' as const,
        ticks: [{ atMs, condition: 'Burning', stacks: 1, duration: 1.5 }],
        timingAnchor: 'castStart' as const,
        timingScale: 'fixed' as const,
        persistsAfterInterrupt: true
      }))
    ]
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
    effects: [
      {
        type: 'strike',
        ticks: [280, 960, 1640, 2320, 3000].map((atMs) => ({
          atMs,
          coefficient: 0.4
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      ...[280, 960, 1640, 2320, 3000].map((atMs) => ({
        type: 'boon' as const,
        boon: 'might',
        stacks: 1,
        duration: 5,
        audience: { recipients: 'party' as const },
        atMs,
        timingAnchor: 'castStart' as const,
        timingScale: 'fixed' as const,
        persistsAfterInterrupt: true
      }))
    ]
  },
  [ID.THROUGH_THE_HEART]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    interruptCommitMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 0.6, projectile: true }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: 'Bleeding', stacks: 1, duration: 8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        projectile: true
      }
    ]
  }
});
