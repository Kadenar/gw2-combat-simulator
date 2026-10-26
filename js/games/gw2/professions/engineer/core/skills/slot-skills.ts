import { RECIPIENT, ACTOR, CONTROL, COMBO_FINISHER, COMBO_FIELD, BOON } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { gadgeteerMineVariant } from '#gw2/professions/engineer/core/traits/tools/toolbelt.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

// Cleansing Burst isn't linked to Healing Turret by the GW2 API's own flip-chain data, so the heal
// slot needs a shared UI-only tile to keep showing whichever of the three is currently armed.
const HEALING_TURRET_PALETTE_TILE = 'engineer-healing-turret';

/** Defines Core heal, utility, elite, turret, and palette-follow-up skill fragments. */
export const ENGINEER_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.HEALING_TURRET]: {
    // Custom: Arms Detonate Healing Turret, fires the automatic Cleansing Burst pulse, and starts the
    // 10s overcharge window; see `core/mechanics/turrets.ts`.

    paletteTileId: HEALING_TURRET_PALETTE_TILE,
    paletteTileOrder: 1,
    cooldown: 20,
    castTimeMs: 520,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 3,
        stacks: 1
      }
    ],
    // Retire the old generation before rebuilding the deployed face; detonation starts parent recharge.
    sideEffects: [
      { on: 'castCommit', do: { type: 'engineer.retire-turret' } },
      { on: 'castCommit', do: { type: 'flipArm', skillId: ID.DETONATE_HEALING_TURRET, durationSec: null } },
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.CLEANSING_BURST } },
      { on: 'castCommit', do: { type: 'engineer.deploy-turret' } }
    ]
  },
  [ID.SUPPLY_CRATE]: {
    cooldown: 75,
    castTimeMs: 680,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Supply Crate',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'control',
        actorType: ACTOR.SUMMON,
        controlKind: CONTROL.STUN
      }
    ]
  },
  [ID.DETONATE_HEALING_TURRET]: {
    // Availability requires the parent skill's exposed window.

    requiresArmedFlip: true,
    paletteTileId: HEALING_TURRET_PALETTE_TILE,
    paletteTileOrder: 2,
    cooldown: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: COMBO_FINISHER.BLAST
          }
        ],
        damageKind: 'explosion',
        name: 'Detonate Healing Turret',
        actorType: ACTOR.PLAYER
      }
    ],
    // Retire the old generation before rebuilding the deployed face; detonation starts parent recharge.
    sideEffects: [
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.DETONATE_HEALING_TURRET } },
      { on: 'castCommit', do: { type: 'engineer.retire-turret' } },
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.CLEANSING_BURST } },
      { on: 'castCommit', do: { type: 'engineer.detonate-turret' } }
    ]
  },
  [ID.CLEANSING_BURST]: {
    // Availability requires the parent skill's exposed window.

    requiresArmedFlip: true,
    paletteTileId: HEALING_TURRET_PALETTE_TILE,
    paletteTileOrder: 3,
    cooldown: 0,
    castTimeMs: 0,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: COMBO_FIELD.WATER,
        duration: 3,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 5,
        stacks: 1
      }
    ],
    // Retire the old face timer and expose detonation until this overcharge's face timer expires.
    sideEffects: [
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.CLEANSING_BURST } },
      { on: 'castCommit', do: { type: 'engineer.retire-turret' } },
      { on: 'castCommit', do: { type: 'flipArm', skillId: ID.DETONATE_HEALING_TURRET, durationSec: null } },
      { on: 'castCommit', do: { type: 'engineer.overcharge-turret' } }
    ]
  },
  [ID.THROW_MINE]: {
    cooldown: 12,
    rechargeAnchor: 'castStart',
    castTimeMs: 360,
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.DETONATE, durationSec: null } }]
  },
  [ID.DETONATE]: {
    // Availability requires the parent skill's exposed window.

    requiresArmedFlip: true,
    cooldown: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: COMBO_FINISHER.BLAST
          }
        ],
        damageKind: 'explosion',
        name: 'Detonate (engineer skill)',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.STUN
      }
    ],
    // Gadgeteer adds one independent mine blast without duplicating the control packet.
    effectVariants: [gadgeteerMineVariant],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.DETONATE } }]
  },
  [ID.DEPLOY_MINE]: {
    cooldown: 15,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1.65,
        hits: 1,
        name: 'Deploy Mine',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.STUN
      }
    ]
  },
  [ID.A_E_D]: {
    cooldown: 24,
    castTimeMs: 520,
    effects: []
  },
  [ID.DETONATE_SUPPLY_CRATE_TURRETS]: {
    cooldown: 25,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Detonate Supply Crate Turrets',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.OVERCHARGE_SUPPLY_CRATE]: {
    cooldown: 1,
    castTimeMs: 0,
    effects: []
  },
  [ID.THROW_MINE_ID_30337]: {
    cooldown: 12,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Throw Mine',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.STUN
      }
    ]
  },
  [ID.DEPLOY_MINE_ID_30893]: {
    cooldown: 15,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1.65,
        hits: 1,
        name: 'Deploy Mine',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.STUN
      }
    ]
  }
});
