/** Each protocol has one skill definition and three in-game button IDs. */
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { AmalgamSkill } from '#gw2/professions/engineer/specializations/amalgam/types.js';

const DEMOLISH_CAST_TIME_MS = 1000 + 560;
const DEMOLISH_RECHARGE_OFFSET_MS = 1000;
// EVTC splits Demolish into a one-second spin and a 560 ms smash; fixed packet
// timestamps preserve the observed animation hits under Quickness.
const DEMOLISH_SPIN_TICKS = Object.freeze([
  { atMs: 360, coefficient: 0.9 },
  { atMs: 640, coefficient: 0.9 },
  { atMs: 920, coefficient: 0.9 }
]);
const DEMOLISH_SMASH_AT_MS = 1440;

// Declare each protocol once; its three catalog entries differ only in mechanic slot.
const shred: SkillDefinition<AmalgamSkill> = {
  name: 'Offensive Protocol: Shred',
  icon: 'https://render.guildwars2.com/file/09A6184ADE9313765B0620780A27B23F4DF31D1A/3680134.png',
  tuningSkillId: ID.OFFENSIVE_PROTOCOL_SHRED,
  countsAsToolbeltSkill: true,
  cooldown: 20,
  castTimeMs: 760,
  comboFinishers: [
    {
      ownerId: 'engineer',
      finisherType: COMBO_FINISHER.PROJECTILE
    }
  ],
  morphKind: 'shred',
  effects: [
    {
      type: 'strike',
      ticks: [
        { atMs: 640, coefficient: 0.96 },
        { atMs: 680, coefficient: 0.96 },
        { atMs: 720, coefficient: 0.96 }
      ],
      timingAnchor: 'castStart',
      timingScale: 'cast',
      name: 'Offensive Protocol: Shred',
      // Each disk is a missile hit and can trigger Aim-Assisted Rocket.
      projectile: true,
      actorType: ACTOR.PLAYER
    },
    {
      type: 'condition',
      condition: CONDITION.IMMOBILIZED,
      stacks: 1,
      duration: 3,
      actorType: ACTOR.PLAYER
    }
  ],
  // This protocol's strain is consumed by Evolve or Silver Lining, never emitted unconditionally.
  sideEffects: [
    {
      on: 'castCommit',
      do: {
        type: 'engineer.morph',
        id: 'strain',
        effects: [
          {
            type: 'boon',
            boon: 'quickness',
            duration: 8,
            sourceId: 'engineer.predator-strain',
            name: 'Predator Strain'
          },
          {
            type: 'buff',
            kind: 'superspeed',
            duration: 8,
            sourceId: 'engineer.predator-strain',
            name: 'Predator Strain'
          }
        ]
      }
    }
  ]
};

const thorns: SkillDefinition<AmalgamSkill> = {
  name: 'Defensive Protocol: Thorns',
  icon: 'https://render.guildwars2.com/file/5B565BA46C111902EE65AB4592590442A5A6E754/3680135.png',
  tuningSkillId: ID.DEFENSIVE_PROTOCOL_THORNS,
  // The intrinsic field-gated retaliation is scheduled once; Morph trait rewards remain shared.
  maximumStacks: 6,
  retaliationInterval: 1,
  countsAsToolbeltSkill: true,
  cooldown: 20,
  // Custom: Activates the selected morph, strain, and form-specific effects; see `amalgam/mechanics/evolved-form.ts`.

  castTimeMs: 0,
  morphKind: 'thorns',
  rapaciousDuration: 8,
  rapaciousInternalCooldown: 0.52,
  effects: [
    {
      type: 'strike',
      coefficient: 1,
      hits: 1,
      name: 'Initial Damage',
      actorType: ACTOR.PLAYER
    }
  ],
  // Retaliation and strain grants are independent components of the accepted Thorns protocol.
  sideEffects: [
    {
      on: 'castCommit',
      do: {
        type: 'engineer.thorns-retaliation',
        id: 'retaliation',
        effects: [{ name: 'Amalgam Morphs', type: 'strike', coefficient: 0.5, hits: 1 }]
      }
    },
    {
      on: 'castCommit',
      do: {
        type: 'engineer.morph',
        id: 'strain',
        effects: [{ name: 'Rapacious Strain', type: 'strike', coefficient: 0.3, hits: 1 }]
      }
    }
  ]
};

const demolish: SkillDefinition<AmalgamSkill> = {
  name: 'Offensive Protocol: Demolish',
  icon: 'https://render.guildwars2.com/file/337E150FB638D080A5A845A73D06B3E3ED7494C7/3680128.png',
  tuningSkillId: ID.OFFENSIVE_PROTOCOL_DEMOLISH,
  countsAsToolbeltSkill: true,
  cooldown: 20,
  // Recharge starts when the logged spin cast ends; the combined animation still includes the follow-up smash.
  rechargeAnchor: 'castStart',
  rechargeOffsetMs: DEMOLISH_RECHARGE_OFFSET_MS,
  castTimeMs: DEMOLISH_CAST_TIME_MS,
  // Commit after the smash so its remaining aftercast can be interrupted.
  interruptCommitMs: 1520,
  morphKind: 'demolish',
  effects: [
    {
      type: 'strike',
      ticks: DEMOLISH_SPIN_TICKS,
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      name: 'Offensive Protocol: Demolish - Packet 1',
      actorType: ACTOR.PLAYER,
      comboFinishers: [
        {
          ownerId: 'engineer',
          finisherType: COMBO_FINISHER.WHIRL
        }
      ]
    },
    {
      type: 'strike',
      ticks: [{ atMs: DEMOLISH_SMASH_AT_MS, coefficient: 2.25 }],
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      name: 'Smash Damage',
      actorType: ACTOR.PLAYER,
      comboFinishers: [
        {
          ownerId: 'engineer',
          finisherType: COMBO_FINISHER.BLAST
        }
      ]
    }
  ],
  // This protocol's strain is consumed by Evolve or Silver Lining, never emitted unconditionally.
  sideEffects: [
    {
      on: 'castCommit',
      do: {
        type: 'engineer.morph',
        id: 'strain',
        effects: [
          {
            type: 'boon',
            boon: 'stability',
            duration: 8,
            stacks: 5,
            sourceId: 'engineer.berserker-strain',
            name: 'Berserker Strain'
          }
        ]
      }
    }
  ]
};

const obliterate: SkillDefinition<AmalgamSkill> = {
  name: 'Offensive Protocol: Obliterate',
  icon: 'https://render.guildwars2.com/file/569A167830C12BFC730095C72F1D095A7323DC3D/3680130.png',
  tuningSkillId: ID.OFFENSIVE_PROTOCOL_OBLITERATE,
  countsAsToolbeltSkill: true,
  cooldown: 20,
  castTimeMs: 800,
  // All protocol slots commit Obliterate at 680 ms and retain the original cast lockout after interruption.
  interruptCommitMs: 680,
  retainsCastLockoutAfterInterrupt: true,
  // Share one impact timing while preserving independent payloads and declaration order.
  morphKind: 'obliterate',
  titanicAttributePerStack: 5,
  effects: impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'fixed' }, [
    {
      type: 'strike',
      coefficient: 2.88,
      hits: 1,
      name: 'Offensive Protocol: Obliterate',
      actorType: ACTOR.PLAYER
    },
    {
      type: 'condition',
      condition: CONDITION.BLEEDING,
      stacks: 8,
      duration: 6,
      actorType: ACTOR.PLAYER
    }
  ]),
  // This protocol's strain is consumed by Evolve or Silver Lining, never emitted unconditionally.
  sideEffects: [
    {
      on: 'castCommit',
      do: {
        type: 'engineer.morph',
        id: 'strain',
        effects: [
          {
            type: 'boon',
            boon: 'might',
            duration: 8,
            stacks: 10,
            sourceId: 'engineer.titanic-strain',
            name: 'Titanic Strain'
          }
        ]
      }
    }
  ]
};

const cleanse: SkillDefinition<AmalgamSkill> = {
  name: 'Defensive Protocol: Cleanse',
  icon: 'https://render.guildwars2.com/file/71A2EA9B60E691E61521C2B621E665146BF1D1DD/3680127.png',
  tuningSkillId: ID.DEFENSIVE_PROTOCOL_CLEANSE,
  countsAsToolbeltSkill: true,
  cooldown: 20,
  castTimeMs: 0,
  morphKind: 'cleanse',
  effects: [
    {
      type: 'boon',
      boon: BOON.PROTECTION,
      duration: 3,
      stacks: 1
    }
  ],
  // This protocol's strain is consumed by Evolve or Silver Lining, never emitted unconditionally.
  sideEffects: [
    {
      on: 'castCommit',
      do: {
        type: 'engineer.morph',
        id: 'strain',
        effects: [
          {
            type: 'boon',
            boon: 'alacrity',
            duration: 8,
            sourceId: 'engineer.replicating-strain',
            name: 'Replicating Strain'
          }
        ]
      }
    }
  ]
};

const pierce: SkillDefinition<AmalgamSkill> = {
  name: 'Offensive Protocol: Pierce',
  icon: 'https://render.guildwars2.com/file/6C253CBFD36ABEB219013B62C4C73193C947ED60/3680131.png',
  tuningSkillId: ID.OFFENSIVE_PROTOCOL_PIERCE,
  countsAsToolbeltSkill: true,
  cooldown: 20,
  castTimeMs: 680,
  morphKind: 'pierce',
  effects: [
    {
      type: 'strike',
      coefficient: 2.88,
      hits: 1,
      name: 'Offensive Protocol: Pierce',
      actorType: ACTOR.PLAYER
    },
    {
      type: 'condition',
      condition: CONDITION.VULNERABILITY,
      stacks: 8,
      duration: 8,
      actorType: ACTOR.PLAYER
    },
    {
      type: 'control',
      actorType: ACTOR.PLAYER,
      controlKind: CONTROL.STUN
    }
  ],
  // This protocol's strain is consumed by Evolve or Silver Lining, never emitted unconditionally.
  sideEffects: [
    {
      on: 'castCommit',
      do: {
        type: 'engineer.morph',
        id: 'strain',
        effects: [
          { type: 'control', controlKind: 'stun', sourceId: 'engineer.volatile-strain', name: 'Volatile Strain' }
        ]
      }
    }
  ]
};

const protect: SkillDefinition<AmalgamSkill> = {
  name: 'Defensive Protocol: Protect',
  icon: 'https://render.guildwars2.com/file/C043950F01DF7093BA14ACCCF67D1A16F245EAA8/3680132.png',
  tuningSkillId: ID.DEFENSIVE_PROTOCOL_PROTECT,
  countsAsToolbeltSkill: true,
  cooldown: 20,
  castTimeMs: 1000,
  morphKind: 'protect',
  effects: [],
  // This protocol's strain is consumed by Evolve or Silver Lining, never emitted unconditionally.
  sideEffects: [
    {
      on: 'castCommit',
      do: {
        type: 'engineer.morph',
        id: 'strain',
        effects: [
          {
            type: 'boon',
            boon: 'resistance',
            duration: 8,
            sourceId: 'engineer.resiliant-strain',
            name: 'Resiliant Strain'
          }
        ]
      }
    }
  ]
};

/** Keep the button IDs used by builds and logs while sharing all protocol mechanics and patch edits. */
function protocolSlots(
  skill: SkillDefinition<AmalgamSkill>,
  ids: readonly [number, number, number]
): Record<number, SkillDefinition<AmalgamSkill>> {
  return Object.fromEntries(
    ids.map((id, index) => {
      const mechanicSlot = index + 2;
      return [id, { ...skill, type: 'Profession', slot: `Profession_${mechanicSlot}`, mechanicSlot }];
    })
  );
}

export const AMALGAM_PROTOCOL_SKILL_MECHANICS: Readonly<Record<string, SkillDefinition<AmalgamSkill>>> = {
  ...protocolSlots(shred, [
    ID.OFFENSIVE_PROTOCOL_SHRED_ID_77103,
    ID.OFFENSIVE_PROTOCOL_SHRED_ID_76866,
    ID.OFFENSIVE_PROTOCOL_SHRED
  ]),
  ...protocolSlots(demolish, [
    ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76927,
    ID.OFFENSIVE_PROTOCOL_DEMOLISH,
    ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76954
  ]),
  ...protocolSlots(obliterate, [
    ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76806,
    ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76901,
    ID.OFFENSIVE_PROTOCOL_OBLITERATE
  ]),
  ...protocolSlots(pierce, [
    ID.OFFENSIVE_PROTOCOL_PIERCE,
    ID.OFFENSIVE_PROTOCOL_PIERCE_ID_77005,
    ID.OFFENSIVE_PROTOCOL_PIERCE_ID_77015
  ]),
  ...protocolSlots(thorns, [
    ID.DEFENSIVE_PROTOCOL_THORNS_ID_77163,
    ID.DEFENSIVE_PROTOCOL_THORNS_ID_77104,
    ID.DEFENSIVE_PROTOCOL_THORNS
  ]),
  ...protocolSlots(cleanse, [
    ID.DEFENSIVE_PROTOCOL_CLEANSE_ID_76798,
    ID.DEFENSIVE_PROTOCOL_CLEANSE_ID_77285,
    ID.DEFENSIVE_PROTOCOL_CLEANSE
  ]),
  ...protocolSlots(protect, [
    ID.DEFENSIVE_PROTOCOL_PROTECT,
    ID.DEFENSIVE_PROTOCOL_PROTECT_ID_77203,
    ID.DEFENSIVE_PROTOCOL_PROTECT_ID_77358
  ])
};
