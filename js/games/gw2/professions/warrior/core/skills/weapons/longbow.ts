/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const WARRIOR_WEAPONS_LONGBOW_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.DUAL_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 840,
    interruptMode: 'commit',
    // Preserve committed arrows and hold the cast lane through the remaining animation.
    interruptCommitMs: 720,
    retainsCastLockoutAfterInterrupt: true,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 560, coefficient: 0.525 },
          { atMs: 600, coefficient: 0.525 }
        ],
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
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
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 3,
        duration: 3
      }
    ])
  },
  [ID.ARCING_ARROW]: {
    castTimeMs: 560,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
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
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 5
      }
    ])
  },
  [ID.SMOLDERING_ARROW]: {
    ammo: 3,
    ammoRecharge: 16,
    ammoCastLockout: 0.5,
    castTimeMs: 160,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.PROJECTILE
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        // The impact is an explosion so explosion-triggered Bladesworn effects can observe it.
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ]
  },
  [ID.PIN_DOWN]: {
    castTimeMs: 680,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.PROJECTILE
      }
    ],
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.44
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 6,
        duration: 12
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 3
      }
    ])
  }
});
