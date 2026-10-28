// Name packets independently for patch deletion while preserving their shared attribution.
/** Core Engineer Elixir Gun skill mechanics. */
import { ACTOR, BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

/** Defines the Elixir Gun equip action and packet-level palette mechanics, including fields and finishers. */
export const ENGINEER_ELIXIR_GUN_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  [ID.ELIXIR_GUN]: {
    // Custom: Equips the kit and updates bundle/weapon state; see `core/hooks.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'equip',
    cooldown: 0,
    castTimeMs: 0,
    effects: [],
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }]
  },
  [ID.TRANQUILIZER_DART]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    kitId: ID.ELIXIR_GUN,
    castTimeMs: 520,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    effects: [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Tranquilizer Dart',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 1,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.GLOB_SHOT]: {
    cooldown: 8,
    kitId: ID.ELIXIR_GUN,
    castTimeMs: 520,
    effects: [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Glob Shot',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 3 },
        boon: BOON.SWIFTNESS,
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.FUMIGATE]: {
    cooldown: 12,
    kitId: ID.ELIXIR_GUN,
    castTimeMs: 1520,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        ticks: [320, 600, 920, 1200, 1520].map((atMs) => ({ atMs, coefficient: 2 / 5 })),
        name: 'Fumigate',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [320, 600, 920, 1200, 1520].map((atMs) => ({
          atMs,
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 2
        })),
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [320, 600, 920, 1200, 1520].map((atMs) => ({
          atMs,
          condition: CONDITION.VULNERABILITY,
          stacks: 1,
          duration: 6
        })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.ACID_BOMB]: {
    cooldown: 12,
    kitId: ID.ELIXIR_GUN,
    castTimeMs: 200,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: COMBO_FIELD.LIGHT,
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        coefficient: 1.35,
        hits: 1,
        name: 'Acid Bomb - Impact',
        actorType: ACTOR.PLAYER,
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 1000 + index * 1000, coefficient: 4.25 / 5 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Acid Bomb - Pulses',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.SUPER_ELIXIR]: {
    cooldown: 16,
    kitId: ID.ELIXIR_GUN,
    castTimeMs: 360,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: COMBO_FIELD.LIGHT,
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    effects: []
  },
  [ID.HEALING_MIST]: {
    cooldown: 20,
    toolbeltParentId: ID.ELIXIR_GUN,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 10,
        stacks: 1
      }
    ]
  },
  [ID.SUPER_ELIXIR_CHAIN_SKILL]: {
    cooldown: 0,
    kitId: ID.ELIXIR_GUN,
    castTimeMs: 0,
    effects: []
  },
  [ID.STOW_ELIXIR_GUN]: {
    // Custom: Stows the active kit and restores weapon state; see `core/hooks.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'stow',
    paletteFlip: false,
    cooldown: 0,
    kitId: ID.ELIXIR_GUN,
    castTimeMs: 0,
    effects: [],
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }]
  }
});
