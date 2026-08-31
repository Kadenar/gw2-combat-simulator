/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const WARRIOR_WEAPONS_LONGBOW_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ARCING_ARROW]: {
    implemented: true,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    quicknessCastTimeMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        // The impact is an explosion so explosion-triggered Bladesworn effects can observe it.
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'condition',
        ticks: [{ atMs: 600, condition: 'Burning', stacks: 1, duration: 5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DUAL_SHOT]: {
    implemented: true,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        chance: 0.2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    quicknessCastTimeMs: 840,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 560, coefficient: 0.525 },
          { atMs: 600, coefficient: 0.525 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PIN_DOWN]: {
    implemented: true,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    quicknessCastTimeMs: 680,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 560, coefficient: 0.44 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 560, condition: 'Bleeding', stacks: 6, duration: 12 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 560, condition: 'Immobilized', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SMOLDERING_ARROW]: {
    implemented: true,
    ammo: 3,
    ammoRecharge: 16,
    ammoCastLockout: 0.5,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    quicknessCastTimeMs: 160,
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        // The impact is an explosion so explosion-triggered Bladesworn effects can observe it.
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'blind',
        metadata: {
          duration: 5
        }
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'daze',
          duration: 1
        }
      }
    ]
  },
  [ID.FAN_OF_FIRE]: {
    quicknessCastTimeMs: 560,
    // The arrows commit at 240 ms, but canceling after release retains the
    // remaining animation as aftercast for ordinary cast-time skills.
    interruptCommitMs: 240,
    retainsCastLockoutAfterInterrupt: true,
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 3 }, (_, index) => ({ atMs: 240, coefficient: 1.32 / 3 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 240, condition: 'Burning', stacks: 3, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
