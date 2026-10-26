import { COMBO_FINISHER, ACTOR, CONTROL, COMBO_FIELD, CONDITION } from '#gw2/platform/constants.js';
/** Core Engineer Bomb Kit skill mechanics. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Defines the equip action, palette skills, stow action, and linked toolbelt skill for Bomb Kit. */
export const ENGINEER_BOMB_KIT_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  [ID.BOMB_KIT]: {
    // Custom: Equips the kit and updates bundle/weapon state; see `core/hooks.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'equip',
    cooldown: 0,
    castTimeMs: 0,
    effects: [],
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }]
  },
  [ID.BOMB]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    kitId: ID.BOMB_KIT,
    castTimeMs: 360,
    effects: [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 1.2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Bomb',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion'
      }
    ]
  },
  [ID.FIRE_BOMB]: {
    cooldown: 8,
    kitId: ID.BOMB_KIT,
    castTimeMs: 600,
    interruptCommitMs: 400,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: COMBO_FIELD.FIRE,
        duration: 3,
        startAnchor: 'castEnd',
        inclusiveExpiry: true
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        ticks: Array.from({ length: 4 }, (_, index) => ({ atMs: 760 + index * 1000, coefficient: 1 / 4 })),
        name: 'Fire Bomb',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 760, condition: CONDITION.BURNING, stacks: 2, duration: 5 }],
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 3 }, (_, index) => ({
          atMs: 1760 + index * 1000,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 2
        })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.GALVANIC_BOMB]: {
    cooldown: 16,
    kitId: ID.BOMB_KIT,
    castTimeMs: 600,
    // Once placement commits at 520 ms, retain the full cast lockout and delayed explosion, confusion, and daze.
    interruptCommitMs: 520,
    retainsCastLockoutAfterInterrupt: true,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 760, timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Galvanic Bomb',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 6,
        duration: 8,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.DAZE
      }
    ])
  },
  [ID.SMOKE_BOMB_ENGINEER_SKILL]: {
    cooldown: 20,
    toolbeltParentId: ID.BOMB_KIT,
    castTimeMs: 0,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.MAGNETIC_BOMB]: {
    cooldown: 20,
    kitId: ID.BOMB_KIT,
    castTimeMs: 600,
    // Once placement commits at 440 ms, retain the full cast lockout and delayed explosion and pull.
    interruptCommitMs: 440,
    retainsCastLockoutAfterInterrupt: true,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 1760, timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          weaponStrengthProfileId: 'bundle.ascended',
          type: 'strike',
          coefficient: 1.5,
          hits: 1,
          name: 'Magnetic Bomb',
          actorType: ACTOR.PLAYER,
          damageKind: 'explosion'
        },
        {
          type: 'control',
          actorType: ACTOR.PLAYER,
          controlKind: CONTROL.PULL
        }
      ]
    )
  },
  [ID.STOW_BOMB_KIT]: {
    // Custom: Stows the active kit and restores weapon state; see `core/hooks.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'stow',
    paletteFlip: false,
    cooldown: 0,
    kitId: ID.BOMB_KIT,
    castTimeMs: 0,
    effects: [],
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }]
  },
  [ID.BIG_OL_BOMB]: {
    cooldown: 20,
    kitId: ID.BOMB_KIT,
    castTimeMs: 600,
    // The placed bomb commits after 520 ms, so its delayed explosion and knockdown survive later interruption.
    interruptCommitMs: 520,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.BLAST,
        successfulCombos: 2
      }
    ],
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 2760, timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          weaponStrengthProfileId: 'bundle.ascended',
          type: 'strike',
          coefficient: 3,
          hits: 1,
          name: "Big Ol' Bomb",
          actorType: ACTOR.PLAYER,
          damageKind: 'explosion'
        },
        {
          type: 'control',
          actorType: ACTOR.PLAYER,
          controlKind: CONTROL.KNOCKDOWN
        }
      ]
    )
  }
});
