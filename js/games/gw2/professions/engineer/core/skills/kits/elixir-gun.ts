import { COMBO_FINISHER, COMBO_FIELD, ACTOR, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
// Name packets independently for patch deletion while preserving their shared attribution.
/** Core Engineer Elixir Gun skill mechanics. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Defines the Elixir Gun equip action and packet-level palette mechanics, including fields and finishers. */
export const ENGINEER_ELIXIR_GUN_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  [ID.ELIXIR_GUN]: {
    // Custom: Equips the kit and updates bundle/weapon state; see `core/hooks.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }],
    kitTransition: 'equip',
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.TRANQUILIZER_DART]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 520,
    cooldown: 0,
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
    ],
    kitId: ID.ELIXIR_GUN
  },
  [ID.GLOB_SHOT]: {
    castTimeMs: 520,
    cooldown: 8,
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
    ],
    kitId: ID.ELIXIR_GUN
  },
  [ID.ACID_BOMB]: {
    castTimeMs: 200,
    cooldown: 12,
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
    ],
    kitId: ID.ELIXIR_GUN
  },
  [ID.SUPER_ELIXIR]: {
    castTimeMs: 360,
    cooldown: 16,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: COMBO_FIELD.LIGHT,
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    effects: [],
    kitId: ID.ELIXIR_GUN
  },
  [ID.FUMIGATE]: {
    castTimeMs: 1520,
    cooldown: 12,
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
    ]),
    kitId: ID.ELIXIR_GUN
  },
  [ID.HEALING_MIST]: {
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 10,
        stacks: 1
      }
    ],
    toolbeltParentId: ID.ELIXIR_GUN
  },
  [ID.SUPER_ELIXIR_CHAIN_SKILL]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitId: ID.ELIXIR_GUN
  },
  [ID.STOW_ELIXIR_GUN]: {
    // Custom: Stows the active kit and restores weapon state; see `core/hooks.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }],
    kitTransition: 'stow',
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitId: ID.ELIXIR_GUN
  }
});
