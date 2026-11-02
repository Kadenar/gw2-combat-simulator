import { ACTOR, BOON, COMBO_FIELD, COMBO_FINISHER, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { gadgeteerMineVariant } from '#gw2/professions/engineer/core/traits/tools/toolbelt.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';

// The declared Healing Turret family shares one palette tile while turret mechanics choose its active face.

/** Defines Core heal, utility, elite, turret, and palette-follow-up skill definitions. */
export const ENGINEER_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<EngineerSkill>>> = {
  [ID.HEALING_TURRET]: {
    name: 'Healing Turret',
    icon: 'https://render.guildwars2.com/file/7D5297C096055DE43153D90F965763F8F2D5FF25/103413.png',
    type: 'Heal',
    slot: 'Heal',

    // Custom: Arms Detonate Healing Turret, fires the automatic Cleansing Burst pulse, and starts the
    // 10s overcharge window; see `core/mechanics/turrets.ts`.

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
    name: 'Supply Crate',
    icon: 'https://render.guildwars2.com/file/1B0C0900BD7F04324E1695BCF97D5AF8AD0609B7/103419.png',
    type: 'Elite',
    slot: 'Elite',

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
    name: 'Detonate Healing Turret',
    icon: 'https://render.guildwars2.com/file/09EB220BF078A6F961E0B0D4F9969669F276DF50/103447.png',
    type: 'Heal',
    slot: 'Heal',
    // Availability requires the parent skill's exposed window.

    requiresArmedFlip: true,
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
    name: 'Cleansing Burst',
    icon: 'https://render.guildwars2.com/file/D7F356D2A7C6B42FF295CDA6765B0B45F508541A/103463.png',
    type: 'Heal',
    slot: 'Heal',
    patchAuthoringExcluded: true,
    // Availability requires the parent skill's exposed window.

    requiresArmedFlip: true,
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
    name: 'Throw Mine',
    icon: 'https://render.guildwars2.com/file/0F0F28210568DB66F8539D684314FC55D8C1022C/103177.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Gadget',
    cooldown: 12,
    rechargeAnchor: 'castStart',
    castTimeMs: 360,
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.DETONATE, durationSec: null } }]
  },
  [ID.DETONATE]: {
    name: 'Detonate',
    icon: 'https://render.guildwars2.com/file/D97BF56EBB6D074BFEFC11E103D6D1F2360C6A17/102902.png',
    type: 'Utility',
    slot: 'Utility',
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
  [ID.A_E_D]: {
    name: 'A.E.D.',
    icon: 'https://render.guildwars2.com/file/37E6184468482B012ACE173098B0784456CA31C5/699525.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Gadget',
    cooldown: 24,
    castTimeMs: 520,
    effects: []
  },
  [ID.DETONATE_SUPPLY_CRATE_TURRETS]: {
    name: 'Detonate Supply Crate Turrets',
    icon: 'https://render.guildwars2.com/file/09EB220BF078A6F961E0B0D4F9969669F276DF50/103447.png',
    type: 'Elite',
    slot: 'Elite',
    patchAuthoringExcluded: true,
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
    name: 'Overcharge Supply Crate',
    icon: 'https://render.guildwars2.com/file/6164B9025A1EC560F490AB654BDCE252E83369F2/1012857.png',
    type: 'Elite',
    slot: 'Elite',
    patchAuthoringExcluded: true,
    cooldown: 1,
    castTimeMs: 0,
    effects: []
  }
};
