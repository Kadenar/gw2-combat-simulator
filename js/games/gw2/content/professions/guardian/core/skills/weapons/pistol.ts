/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.JURISDICTION]: {
    implemented: true,
    quicknessCastTimeMs: 800,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 640, coefficient: 3, metadata: { projectile: true } }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: 'Burning', stacks: 5, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'stun'
        }
      }
    ]
  },
  [ID.HAIL_OF_JUSTICE]: {
    implemented: true,
    quicknessCastTimeMs: 1120,
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
          metadata: { projectile: true }
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
          metadata: { projectile: true }
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
          metadata: { projectile: true }
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PEACEKEEPER]: {
    implemented: true,
    quicknessCastTimeMs: 1040,
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
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 280, condition: 'Burning', stacks: 1, duration: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 480, condition: 'Burning', stacks: 1, duration: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: 'Burning', stacks: 1, duration: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 800, condition: 'Burning', stacks: 1, duration: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 960, condition: 'Burning', stacks: 1, duration: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SYMBOL_OF_IGNITION]: {
    implemented: true,
    quicknessCastTimeMs: 360,
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
        timingScale: 'fixed'
      },
      ...[280, 960, 1640, 2320, 3000].map((atMs) => ({
        type: 'boon' as const,
        boon: 'might',
        stacks: 1,
        duration: 5,
        recipients: 'party',
        atMs,
        timingAnchor: 'castStart' as const,
        timingScale: 'fixed' as const
      }))
    ]
  },
  [ID.THROUGH_THE_HEART]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 0.6, metadata: { projectile: true } }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: 'Bleeding', stacks: 1, duration: 8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { projectile: true }
      }
    ]
  }
});
