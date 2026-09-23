/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const WARRIOR_WEAPONS_LONGBOW_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.ARCING_ARROW]: {
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    castTimeMs: 560,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.5,
        // The impact is an explosion so explosion-triggered Bladesworn effects can observe it.
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 5
      }
    ])
  },
  [ID.DUAL_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        chance: 0.2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    castTimeMs: 840,
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
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    castTimeMs: 680,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.44
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 6,
        duration: 12
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 3
      }
    ])
  },
  [ID.SMOLDERING_ARROW]: {
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
    castTimeMs: 160,
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        // The impact is an explosion so explosion-triggered Bladesworn effects can observe it.
        damageKind: 'explosion'
      },
      {
        type: 'blind',
        duration: 5
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ]
  },
  [ID.FAN_OF_FIRE]: {
    castTimeMs: 560,
    // The arrows commit at 240 ms, but canceling after release retains the
    // remaining animation as aftercast for ordinary cast-time skills.
    interruptCommitMs: 240,
    retainsCastLockoutAfterInterrupt: true,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.32,
        hits: 3
      },
      // Apply each Burning stack separately so same-impact relic checks observe every application.
      ...Array.from({ length: 3 }, () => ({
        type: 'condition' as const,
        condition: 'Burning' as const,
        stacks: 1,
        duration: 3
      }))
    ])
  }
});
