/** Core Engineer Elixir Gun skill mechanics. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Defines the Elixir Gun equip action and packet-level palette mechanics, including fields and finishers. */
export const ENGINEER_ELIXIR_GUN_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  [ID.ELIXIR_GUN]: {
    // Custom: Equips the kit and updates bundle/weapon state; see `core/mechanics/kits.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'engineer.kit-equip',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitName: 'Elixir Gun'
  },
  [ID.TRANQUILIZER_DART]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 520,
    cooldown: 0,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Projectile',
        chance: 0.2,
        preferredFieldTypes: ['Fire'],
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Tranquilizer Dart',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ],
    kit: 'Elixir Gun'
  },
  [ID.GLOB_SHOT]: {
    castTimeMs: 520,
    cooldown: 8,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Glob Shot',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 3,
        stacks: 1
      }
    ],
    kit: 'Elixir Gun'
  },
  [ID.ACID_BOMB]: {
    castTimeMs: 200,
    cooldown: 12,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: 'Light',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1.35,
        hits: 1,
        name: 'Acid Bomb',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 1000 + index * 1000, coefficient: 4.25 / 5 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Acid Bomb',
        actorType: 'player'
      }
    ],
    kit: 'Elixir Gun'
  },
  [ID.SUPER_ELIXIR]: {
    castTimeMs: 360,
    cooldown: 16,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: 'Light',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    effects: [],
    kit: 'Elixir Gun'
  },
  [ID.FUMIGATE]: {
    castTimeMs: 1520,
    cooldown: 12,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [320, 600, 920, 1200, 1520].map((atMs) => ({ atMs, coefficient: 2 / 5 })),
        name: 'Fumigate',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [320, 600, 920, 1200, 1520].map((atMs) => ({ atMs, condition: 'Poisoned', stacks: 1, duration: 2 })),
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [320, 600, 920, 1200, 1520].map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 1,
          duration: 6
        })),
        actorType: 'player'
      }
    ]),
    kit: 'Elixir Gun'
  },
  [ID.HEALING_MIST]: {
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 10,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Elixir Gun'
  },
  [ID.SUPER_ELIXIR_CHAIN_SKILL]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kit: 'Elixir Gun'
  },
  [ID.STOW_ELIXIR_GUN]: {
    // Custom: Stows the active kit and restores weapon state; see `core/mechanics/kits.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'engineer.kit-stow',
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kit: 'Elixir Gun'
  }
});
