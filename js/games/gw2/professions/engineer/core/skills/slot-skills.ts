import type { Skill } from '#gw2/platform/skills/types.js';
import { gadgeteerMineVariant } from '#gw2/professions/engineer/core/traits/tools/toolbelt.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

// Cleansing Burst isn't linked to Healing Turret by the GW2 API's own flip-chain data, so the heal
// slot needs a shared UI-only tile to keep showing whichever of the three is currently armed.
const HEALING_TURRET_PALETTE_TILE = 'engineer-healing-turret';

/** Defines Core heal, utility, elite, turret, and palette-follow-up skill fragments. */
export const ENGINEER_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.HEALING_TURRET]: {
    // Retire the old generation before rebuilding the deployed face; detonation starts parent recharge.
    sideEffects: [
      { on: 'castCommit', do: { type: 'engineer.retire-turret' } },
      { on: 'castCommit', do: { type: 'flipArm', skillId: ID.DETONATE_HEALING_TURRET, durationSec: null } },
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.CLEANSING_BURST } },
      { on: 'castCommit', do: { type: 'engineer.deploy-turret' } }
    ],
    // Custom: Arms Detonate Healing Turret, fires the automatic Cleansing Burst pulse, and starts the
    // 10s overcharge window; see `core/mechanics/weapons.ts`.

    paletteFlipSkillId: ID.DETONATE_HEALING_TURRET,
    paletteTileId: HEALING_TURRET_PALETTE_TILE,
    paletteTileOrder: 1,
    castTimeMs: 520,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.SUPPLY_CRATE]: {
    castTimeMs: 680,
    cooldown: 75,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Supply Crate',
        actorType: 'summon'
      },
      {
        type: 'control',
        actorType: 'summon',
        controlKind: 'stun'
      }
    ]
  },
  [ID.DETONATE_HEALING_TURRET]: {
    // Retire the old generation before rebuilding the deployed face; detonation starts parent recharge.
    sideEffects: [
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.DETONATE_HEALING_TURRET } },
      { on: 'castCommit', do: { type: 'engineer.retire-turret' } },
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.CLEANSING_BURST } },
      { on: 'castCommit', do: { type: 'engineer.detonate-turret' } }
    ],
    // Availability requires the parent skill's exposed window.

    requiresArmedFlip: true,
    paletteTileId: HEALING_TURRET_PALETTE_TILE,
    paletteTileOrder: 2,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        damageKind: 'explosion',
        name: 'Detonate Healing Turret',
        actorType: 'player'
      }
    ]
  },
  [ID.CLEANSING_BURST]: {
    // Retire the old face timer and expose detonation until this overcharge's face timer expires.
    sideEffects: [
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.CLEANSING_BURST } },
      { on: 'castCommit', do: { type: 'engineer.retire-turret' } },
      { on: 'castCommit', do: { type: 'flipArm', skillId: ID.DETONATE_HEALING_TURRET, durationSec: null } },
      { on: 'castCommit', do: { type: 'engineer.overcharge-turret' } }
    ],
    // Availability requires the parent skill's exposed window.

    requiresArmedFlip: true,
    paletteTileId: HEALING_TURRET_PALETTE_TILE,
    paletteTileOrder: 3,
    castTimeMs: 0,
    cooldown: 0,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: 'Water',
        duration: 3,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.THROW_MINE]: {
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.DETONATE, durationSec: null } }],
    paletteFlipSkillId: ID.DETONATE,
    castTimeMs: 360,
    cooldown: 12,
    rechargeAnchor: 'castStart'
  },
  [ID.DETONATE]: {
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.DETONATE } }],
    // Gadgeteer adds one independent mine blast without duplicating the control packet.
    effectVariants: [gadgeteerMineVariant],
    // Availability requires the parent skill's exposed window.

    requiresArmedFlip: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        damageKind: 'explosion',
        name: 'Detonate (engineer skill)',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'stun'
      }
    ]
  },
  [ID.DEPLOY_MINE]: {
    castTimeMs: 360,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1.65,
        hits: 1,
        name: 'Deploy Mine',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'stun'
      }
    ]
  },
  [ID.A_E_D]: {
    castTimeMs: 520,
    cooldown: 24,
    effects: []
  },
  [ID.DETONATE_SUPPLY_CRATE_TURRETS]: {
    castTimeMs: 0,
    cooldown: 25,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Detonate Supply Crate Turrets',
        actorType: 'player'
      }
    ]
  },
  [ID.OVERCHARGE_SUPPLY_CRATE]: {
    castTimeMs: 0,
    cooldown: 1,
    effects: []
  },
  [ID.THROW_MINE_ID_30337]: {
    castTimeMs: 360,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Throw Mine',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'stun'
      }
    ]
  },
  [ID.DEPLOY_MINE_ID_30893]: {
    castTimeMs: 360,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1.65,
        hits: 1,
        name: 'Deploy Mine',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'stun'
      }
    ]
  }
});
