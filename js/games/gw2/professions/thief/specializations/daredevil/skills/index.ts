import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import type { Skill, SkillDefinition } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { DAREDEVIL_GUILD_ATTACK_SKILLS } from '#gw2/professions/thief/specializations/daredevil/skills/guild-attacks.js';

// Accepted physical skills fire the point where Brawler's Tenacity grants endurance.
const PHYSICAL_ENDURANCE: NonNullable<Skill['sideEffects']> = [
  { on: 'castStart', do: { type: 'thief.physical-skill' } }
];

const DAREDEVIL_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.IMPACT_STRIKE]: {
    name: 'Impact Strike',
    icon: 'https://render.guildwars2.com/file/E4D3BD70B351F2BE48E43CF0605B449221E6FE06/1058619.png',
    type: 'Elite',
    slot: 'Elite',
    skillFamily: 'Physical',
    cooldown: 25,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.75 }],
        name: 'Impact Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.DAZE
      }
    ]
  },
  [ID.FINISHING_BLOW]: {
    name: 'Finishing Blow',
    icon: 'https://render.guildwars2.com/file/C24115D6EAA402EA1DFB7326047AE2B54FDF1600/1058618.png',
    type: 'Elite',
    slot: 'Elite',
    cooldown: 0,
    castTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 4 }],
        name: 'Finishing Blow',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.UPPERCUT]: {
    name: 'Uppercut',
    icon: 'https://render.guildwars2.com/file/50C80B47284B618039B173A1EC5EA81AA6B577D4/1058617.png',
    type: 'Elite',
    slot: 'Elite',
    cooldown: 0,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.25 }],
        name: 'Uppercut (Daredevil skill)',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.LAUNCH
      }
    ]
  },
  [ID.IMPAIRING_DAGGERS]: {
    name: 'Impairing Daggers',
    icon: 'https://render.guildwars2.com/file/265D095168000FA9A20BC11E43A3BB63B90C349B/1058635.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Physical',
    cooldown: 15,
    castTimeMs: 480,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [
          { atMs: 360, coefficient: 0.75 },
          { atMs: 440, coefficient: 0.75 },
          { atMs: 520, coefficient: 1 }
        ],
        name: 'Impairing Daggers',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: CONDITION.POISONED, stacks: 3, duration: 10 }],
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: CONDITION.SLOW, stacks: 1, duration: 5 }],
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [{ atMs: 520, condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 2 }],
        actorType: ACTOR.PLAYER
      }
    ]),
    sideEffects: PHYSICAL_ENDURANCE
  },
  [ID.CHANNELED_VIGOR]: {
    name: 'Channeled Vigor',
    icon: 'https://render.guildwars2.com/file/AA5F2B2C68423A9A2CACFD6DFB74F05228E0A2B2/1058620.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Physical',
    cooldown: 20,
    resourceGain: 125,
    castTimeMs: 480,
    // The endurance grant commits at 440 ms, allowing the remaining cast to be interrupted.
    interruptCommitMs: 440,
    effects: [],
    // Keep the intrinsic completion grant separate from the acceptance trait reward.
    sideEffects: [
      ...PHYSICAL_ENDURANCE,
      { on: 'castCommit', do: { type: 'resourceGrant', resource: 'endurance', amount: { skillField: 'resourceGain' } } }
    ]
  },
  [ID.REFLEXIVE_STRIKE]: {
    name: 'Reflexive Strike',
    icon: 'https://render.guildwars2.com/file/CB2B0F40CE0A51C2C91A24751FEBF7F26305292C/1058632.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Physical',
    cooldown: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.75 }],
        name: 'Reflexive Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.KNOCKDOWN
      }
    ],
    sideEffects: PHYSICAL_ENDURANCE
  },
  [ID.DISTRACTING_DAGGERS]: {
    name: 'Distracting Daggers',
    icon: 'https://render.guildwars2.com/file/F3F3FD0EFBEE58CDE70B290C380C1D4102E9600B/1058630.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Physical',
    ammoCastLockout: 1,
    cooldown: 20,
    ammo: 3,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.55 }],
        name: 'Distracting Daggers',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.DAZE
      }
    ],
    sideEffects: PHYSICAL_ENDURANCE
  },
  [ID.BANDITS_DEFENSE]: {
    name: "Bandit's Defense",
    icon: 'https://render.guildwars2.com/file/4EF0035DE5239258469E5348F1BF4CD031619573/1058629.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Physical',
    cooldown: 16,
    castTimeMs: 1000,
    effects: [],
    sideEffects: PHYSICAL_ENDURANCE
  },
  [ID.PALM_STRIKE]: {
    name: 'Palm Strike',
    icon: 'https://render.guildwars2.com/file/96580AB413D9791D53D45093063F54CD9F56C513/1058634.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Physical',
    cooldown: 0,
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.75 }],
        name: 'Palm Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 6.56,
        hits: 2,
        atMs: 2000,
        name: 'Pulmonary Impact',
        actorType: ACTOR.PLAYER,
        canCrit: false,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.STUN
      }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.PALM_STRIKE } }]
  },
  [ID.PULMONARY_IMPACT_TRAIT_SKILL]: {
    name: 'Pulmonary Impact (trait skill)',
    icon: 'https://render.guildwars2.com/file/96580AB413D9791D53D45093063F54CD9F56C513/1058634.png',
    type: 'Action',
    slot: 'Action',
    skillFamily: 'Physical',
    cooldown: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 3.28 }],
        name: 'Pulmonary Impact (trait skill)',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FIST_FLURRY]: {
    name: 'Fist Flurry',
    icon: 'https://render.guildwars2.com/file/3B267195CECDF50705092272D0190CA9A391B507/1058631.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Physical',
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    flipDuration: 5,
    cooldown: 16,
    castTimeMs: 680,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [120, 280, 400, 560, 680].map((atMs) => ({ atMs, coefficient: 0.75 })),
        name: 'Fist Flurry',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [{ atMs: 120, condition: CONDITION.VULNERABILITY, stacks: 1, duration: 5 }],
        actorType: ACTOR.PLAYER
      }
    ]),
    // Only a complete on-target flurry exposes Palm Strike; accepted casts still grant trait endurance.
    sideEffects: [
      ...PHYSICAL_ENDURANCE,
      {
        on: 'castCommit',
        when: (_runtime, cast) => cast.command.offTarget !== true && !castWasInterrupted(cast),
        do: {
          type: 'flipArm',
          skillId: ID.PALM_STRIKE
        }
      }
    ]
  },
  [ID.BOUND]: {
    name: 'Bound',
    icon: 'https://render.guildwars2.com/file/F3E22D0FDFDB436780BD4ACBA5D135EE40507FFD/1058554.png',
    type: 'Action',
    slot: 'Action',
    cooldown: 0,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 3.5 }],
        name: 'Bound',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DASH_TRAIT_SKILL]: {
    name: 'Dash (trait skill)',
    icon: 'https://render.guildwars2.com/file/00A434BE7B4B9AE0D22D6AC50A18C0E117345AC2/991941.png',
    type: 'Action',
    slot: 'Action',
    patchAuthoringExcluded: true,
    cooldown: 0,
    castTimeMs: 520,
    effects: [
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 10,
        stacks: 1
      }
    ]
  },
  [ID.IMPALING_LOTUS]: {
    name: 'Impaling Lotus',
    icon: 'https://render.guildwars2.com/file/E5724D46CEE62333E00CE26905C5FDD5439F6667/1058552.png',
    type: 'Action',
    slot: 'Action',
    cooldown: 0,
    castTimeMs: 0,
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: COMBO_FINISHER.WHIRL
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [200, 360, 520].map((atMs) => ({ atMs, coefficient: 0.1875 })),
        name: 'Impaling Lotus',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 200,
            condition: CONDITION.BLEEDING,
            stacks: 2,
            duration: 4
          },
          {
            atMs: 360,
            condition: CONDITION.TORMENT,
            stacks: 2,
            duration: 4
          },
          {
            atMs: 520,
            condition: CONDITION.CRIPPLED,
            stacks: 1,
            duration: 3
          }
        ],
        actorType: ACTOR.PLAYER
      }
    ])
  }
};

/** One complete module collection includes authored skills, generated attacks, and simulator actions. */
export const DAREDEVIL_SKILLS = Object.freeze([
  ...materializeSkillDefinitions(DAREDEVIL_SKILL_MECHANICS),
  ...DAREDEVIL_GUILD_ATTACK_SKILLS
]);
