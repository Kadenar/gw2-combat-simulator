import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { SPECTER_GUILD_ATTACK_SKILLS } from '#gw2/professions/thief/specializations/specter/skills/guild-attacks.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

// Shadow Shroud entry and exit are state-selected variants of one UI tile.
const SHADOW_SHROUD_PALETTE_TILE = 'specter-shadow-shroud';

// Share each impact's timing while preserving effect order and effect-local payloads.
const SPECTER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ThiefSkill>>> = {
  [ID.SIPHON]: {
    name: 'Siphon',
    icon: 'https://render.guildwars2.com/file/C6D7F7A40A041D52D15E595D3DA59F24B8B1A6E9/2503748.png',
    type: 'Profession',
    slot: 'Profession_1',

    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    shadowForceGain: 25,
    stealTraitSkill: true,
    // Siphon adds Lead Attacks and Sleight of Hand reductions instead of multiplying them.
    stealRechargeMode: 'additive',
    cooldown: 18,
    castTimeMs: 520,
    // Siphon's committed effects survive cancellation of the remaining animation.
    interruptCommitMs: 440,
    effects: [
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: CONDITION.SLOW, stacks: 1, duration: 5 }],
        persistsAfterInterrupt: true,
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.siphon' } }]
  },
  [ID.ENTER_SHADOW_SHROUD]: {
    name: 'Enter Shadow Shroud',
    icon: 'https://render.guildwars2.com/file/0A93EB27CFAE0291F0D009E15B4545DD7D054A28/2503737.png',
    type: 'Profession',
    slot: 'Profession_2',
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    shadowShroudTransition: 'enter',
    cooldown: 8,
    paletteTileId: SHADOW_SHROUD_PALETTE_TILE,
    paletteTileOrder: 1,
    castTimeMs: 0,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.enter-shadow-shroud' } },
      {
        on: 'castCommit',
        do: {
          type: 'thief.shroud-entry-barrier',
          id: 'barrier',
          effects: [
            {
              type: 'buff',
              name: 'barrier',
              kind: 'barrier',
              stacks: 1,
              duration: 5,
              audience: {
                recipients: RECIPIENT.PARTY,
                affectsSelf: false,
                maximumRecipients: 1,
                eligibleCompanionIds: []
              }
            }
          ]
        }
      }
    ]
  },
  [ID.HAUNT_SHOT]: {
    name: 'Haunt Shot',
    icon: 'https://render.guildwars2.com/file/409264A2535956BCFDD9CA608008A79FB027F06E/2503741.png',
    type: 'Weapon',
    slot: 'Weapon_1',

    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    shadowShroudSkill: true,
    castTimeMs: 640,
    interruptCommitMs: 560,
    effects: [
      ...impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        {
          weaponStrengthProfileId: 'transform.shadow-shroud',
          type: 'strike',
          coefficient: 1.075,
          hits: 1,
          name: 'Haunt Shot',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          stacks: 1,
          duration: 6,
          actorType: ACTOR.PLAYER
        }
      ]),
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 5,
        stacks: 1,
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.GRASPING_SHADOWS]: {
    name: 'Grasping Shadows',
    icon: 'https://render.guildwars2.com/file/069BBE2DDF56A0C0565D475E1715157A514FABD3/2503740.png',
    type: 'Weapon',
    slot: 'Weapon_2',

    cooldown: 3,
    shadowShroudSkill: true,
    castTimeMs: 240,
    // The ground effect is already placed when a following shroud skill cancels the remaining animation.
    interruptCommitMs: 200,
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    effects: impactEffects(
      { atMs: 1000, timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          weaponStrengthProfileId: 'transform.shadow-shroud',
          type: 'strike',
          coefficient: 1.66,
          hits: 1,
          name: 'Grasping Shadows',
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
          condition: CONDITION.TORMENT,
          stacks: 2,
          duration: 6,
          actorType: ACTOR.PLAYER
        }
      ]
    )
  },
  [ID.DAWNS_REPOSE]: {
    name: "Dawn's Repose",
    icon: 'https://render.guildwars2.com/file/060A9A76FC69FB2B25A462C84F475A2580501E0C/2503734.png',
    type: 'Weapon',
    slot: 'Weapon_3',

    cooldown: 8,
    shadowShroudSkill: true,
    // The leap hits at 800 ms and finishes its activation at 960 ms in the supplied log.
    castTimeMs: 960,
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: COMBO_FINISHER.LEAP
      }
    ],
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        weaponStrengthProfileId: 'transform.shadow-shroud',
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: "Dawn's Repose",
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.FEAR,
        stacks: 1,
        duration: 1,
        actorType: ACTOR.PLAYER
      }
    ]),
    // Successful completion grants the intrinsic barrier independently of trait rewards.
    sideEffects: [
      {
        on: 'castCommit',
        when: (_runtime, cast) => !castWasInterrupted(cast),
        do: {
          type: 'thief.dawns-barrier',
          id: 'barrier',
          effects: [
            {
              type: 'buff',
              name: 'barrier',
              kind: 'barrier',
              stacks: 1,
              duration: 5,
              audience: {
                recipients: RECIPIENT.PARTY,
                affectsSelf: true,
                maximumRecipients: 5,
                eligibleCompanionIds: []
              }
            }
          ]
        }
      }
    ]
  },
  [ID.WELL_OF_SILENCE]: {
    name: 'Well of Silence',
    icon: 'https://render.guildwars2.com/file/6B22FFB6CE4764F31FF7B7300E5C694E296CC1AD/2503754.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Well',
    movementSkill: true,
    // Well placement shadowsteps the player, so shadowstep rewards also apply.
    shadowstepSkill: true,
    cooldown: 25,
    castTimeMs: 360,
    effects: [
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.DAZE
      }
    ]
  },
  [ID.ETERNAL_NIGHT]: {
    name: 'Eternal Night',
    icon: 'https://render.guildwars2.com/file/D6CB992E12F0BCB2984C3FEA066FA1B7A077752A/2503738.png',
    type: 'Weapon',
    slot: 'Weapon_4',

    cooldown: 8,
    shadowShroudSkill: true,
    // The supplied log retains the 360/680 ms impacts within a 760 ms activation.
    castTimeMs: 760,
    // Both impacts have committed before the animation finishes.
    interruptCommitMs: 720,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        weaponStrengthProfileId: 'transform.shadow-shroud',
        type: 'strike',
        ticks: Array.from({ length: 2 }, (_, index) => ({ atMs: 360 + index * 320, coefficient: 3.5 / 2 })),
        name: 'Eternal Night',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: CONDITION.CHILLED, stacks: 1, duration: 2 }],
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [{ atMs: 680, condition: CONDITION.WEAKNESS, stacks: 1, duration: 4 }],
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [360, 680].map((atMs) => ({ atMs, condition: CONDITION.POISONED, stacks: 2, duration: 4 })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.EXIT_SHADOW_SHROUD]: {
    name: 'Exit Shadow Shroud',
    icon: 'https://render.guildwars2.com/file/44F8D2065727B25C7DA9D5E52065D1A86CC6330F/2503739.png',
    type: 'Profession',
    slot: 'Profession_2',
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    shadowShroudTransition: 'exit',
    cooldown: 0,
    paletteTileId: SHADOW_SHROUD_PALETTE_TILE,
    paletteTileOrder: 2,
    castTimeMs: 0,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.exit-shadow-shroud' } }]
  },
  [ID.SHADOWFALL]: {
    name: 'Shadowfall',
    icon: 'https://render.guildwars2.com/file/0F27940ECADC0A47D809E5EBCBD1E80607417403/2503745.png',
    type: 'Elite',
    slot: 'Elite',
    skillFamily: 'Well',
    // The elite well also shadowsteps, qualifying for movement and shadowstep rewards.
    movementSkill: true,
    shadowstepSkill: true,
    cooldown: 75,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [120, 240, 360].map((atMs) => ({ atMs, coefficient: 4.5 / 3 })),
        name: 'Shadowfall',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.PULL
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.PULL
      }
    ]
  },
  [ID.WELL_OF_SORROW]: {
    name: 'Well of Sorrow',
    icon: 'https://render.guildwars2.com/file/494191F4140194C74A1AC0CCF137710290364CA7/2503755.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Well',
    movementSkill: true,
    shadowstepSkill: true,
    cooldown: 20,
    castTimeMs: 600,
    // Once placed, the well keeps pulsing through cancellation of its remaining animation.
    interruptCommitMs: 520,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 400 + index * 1000, coefficient: 1.11 / 5 })),
        name: 'Well of Sorrow',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 400, condition: CONDITION.TORMENT, stacks: 2, duration: 6 },
          { atMs: 1400, condition: CONDITION.BLEEDING, stacks: 3, duration: 6 },
          { atMs: 2400, condition: CONDITION.TORMENT, stacks: 2, duration: 6 },
          { atMs: 3400, condition: CONDITION.POISONED, stacks: 3, duration: 6 },
          { atMs: 4400, condition: CONDITION.TORMENT, stacks: 2, duration: 6 }
        ],
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.WELL_OF_GLOOM]: {
    name: 'Well of Gloom',
    icon: 'https://render.guildwars2.com/file/BE0101D159F09B45F1CA58F5E4E7562E05B40E37/2503753.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Well',
    movementSkill: true,
    // Healing wells retain the same shadowstep classification as utility wells.
    shadowstepSkill: true,
    cooldown: 20,
    castTimeMs: 680,
    effects: [
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: CONDITION.CRIPPLED, stacks: 1, duration: 2 }],
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.WELL_OF_TEARS]: {
    name: 'Well of Tears',
    icon: 'https://render.guildwars2.com/file/347CEB77023C76989211D59EBFC6970EEA7354E1/2503756.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Well',
    movementSkill: true,
    shadowstepSkill: true,
    cooldown: 20,
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 0 + index * 1000, coefficient: 5 / 5 })),
        name: 'Well of Tears',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.WELL_OF_BOUNTY]: {
    name: 'Well of Bounty',
    icon: 'https://render.guildwars2.com/file/CF17E53430D9055B599FD751994370106143077D/2503752.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Well',
    movementSkill: true,
    shadowstepSkill: true,
    cooldown: 20,
    castTimeMs: 400,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.STABILITY,
        duration: 5,
        stacks: 2,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 15,
        stacks: 8,
        atMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.FURY,
        duration: 5,
        stacks: 1,
        atMs: 2000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.VIGOR,
        duration: 8,
        stacks: 1,
        atMs: 3000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 12,
        stacks: 1,
        atMs: 4000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MIND_SHOCK]: {
    name: 'Mind Shock',
    icon: 'https://render.guildwars2.com/file/A5A90244CD1A151F384EE6F64BF93622E50FBE19/2503743.png',
    type: 'Weapon',
    slot: 'Weapon_5',

    cooldown: 16,
    shadowShroudSkill: true,
    castTimeMs: 360,
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    effects: [
      {
        weaponStrengthProfileId: 'transform.shadow-shroud',
        type: 'strike',
        ticks: [{ atMs: 3000, coefficient: 2 }],
        name: 'Mind Shock',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.STABILITY,
        duration: 4,
        stacks: 3
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        atMs: 3000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        controlKind: CONTROL.STUN
      }
    ]
  }
};

/** One complete module collection includes authored skills, generated attacks, and simulator actions. */
export const SPECTER_SKILLS = Object.freeze([
  ...materializeSkillDefinitions(SPECTER_SKILL_MECHANICS),
  ...SPECTER_GUILD_ATTACK_SKILLS
]);
