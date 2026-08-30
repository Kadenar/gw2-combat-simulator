/** Core Engineer Elixir Gun skill mechanics. */
import { ENGINEER_SKILL_IDS as ID } from '../../../data/ids.js';
import type { SkillFragment } from '../../../../../../platform/engine/types.js';

// Owns the equip action and packet-level palette mechanics so fields and finishers stay observable.
export const ENGINEER_ELIXIR_GUN_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.ELIXIR_GUN]: {
    implemented: true,
    handlerId: 'engineer.kit-equip',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitName: 'Elixir Gun'
  },
  [ID.TRANQUILIZER_DART]: {
    implemented: true,
    castTimeMs: 750,
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
    implemented: true,
    castTimeMs: 750,
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
    implemented: true,
    castTimeMs: 250,
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
        coefficient: 4.25,
        hits: 5,
        atMs: 1000,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Acid Bomb',
        actorType: 'player'
      }
    ],
    kit: 'Elixir Gun'
  },
  [ID.SUPER_ELIXIR]: {
    implemented: true,
    castTimeMs: 500,
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
    implemented: true,
    castTimeMs: 2250,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 5,
        atMs: 304,
        intervalMs: 304,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Fumigate',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 2,
        applications: 5,
        atMs: 304,
        intervalMs: 304,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 6,
        applications: 5,
        atMs: 304,
        intervalMs: 304,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        actorType: 'player'
      }
    ],
    kit: 'Elixir Gun'
  },
  [ID.HEALING_MIST]: {
    implemented: true,
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
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kit: 'Elixir Gun'
  },
  [ID.STOW_ELIXIR_GUN]: {
    implemented: true,
    handlerId: 'engineer.kit-stow',
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kit: 'Elixir Gun'
  }
});
