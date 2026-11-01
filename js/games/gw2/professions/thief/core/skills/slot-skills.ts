import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { ACTOR, BOON, CONDITION, CONTROL, RECIPIENT, STATUS } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { definePeriodicTask } from '#gw2/platform/simulation/periodic-task.js';
import type { Skill, SkillDefinition } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

// The prepared field's five packets begin after the activation-to-damage delay observed in EVTC.
const THOUSAND_NEEDLES_INITIAL_DELAY_MS = 280;
const PITFALL_PULSE_OFFSETS_MS = [1000, 2000, 3000];

// Signets announce their completed activation at cast end, so trait rewards never follow an interrupted cast.
const SIGNET_COMPLETED: NonNullable<Skill['sideEffects']> = [
  { on: 'castCommit', do: { type: 'thief.signet-completed' } }
];

// EVTC-measured Quickness timings keep utility casts aligned with their observed cast-lane occupancy.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.WITHDRAW]: {
    name: 'Withdraw',
    description: 'Trick. Cure conditions, then roll backward while healing and evading attacks.',
    icon: 'https://render.guildwars2.com/file/C546789E0BBB6F91666B92066DEF18AA0F146B79/104068.png',
    type: 'Heal',
    slot: 'Heal',

    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 18,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.PREPARE_THOUSAND_NEEDLES]: {
    name: 'Prepare Thousand Needles',
    description: 'Preparation. Mark your current area with inhibiting magic, readying the location to poison enemies.',
    icon: 'https://render.guildwars2.com/file/F0A856B0596935DC9BF4FBCA95069D75264B5570/2175070.png',
    type: 'Utility',
    slot: 'Utility',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 30,
    rechargeAnchor: 'castStart',
    initiativeCost: 0,
    duration: 3,
    castTimeMs: 600,
    // Placement survives cancellation once the preparation commits.
    interruptCommitMs: 400,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.prepare-trap' } }]
  },
  [ID.HIDE_IN_SHADOWS]: {
    name: 'Hide in Shadows',
    description: 'Deception. Vanish in stealth and cure conditions. Then gain regeneration and heal yourself.',
    icon: 'https://render.guildwars2.com/file/C90D2FF2084A207F9C974C90049AF1A3F8B4B548/104070.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Deception',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 25,
    initiativeCost: 0,
    // The heal occupies its full recorded animation before granting stealth.
    castTimeMs: 920,
    effects: [
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        duration: 6,
        stacks: 1
      }
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.stealth' } }]
  },
  [ID.CALTROPS]: {
    name: 'Caltrops',
    description: 'Trick. Scatter caltrops that bleed and cripple foes.',
    icon: 'https://render.guildwars2.com/file/A85F59D91114D0702C3AB54A0AA81EC1CAE66CF5/103073.png',
    type: 'Utility',
    slot: 'Utility',

    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 24,
    initiativeCost: 0,
    castTimeMs: 920,
    // Once placed, the field keeps pulsing after the cast is interrupted.
    interruptCommitMs: 800,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'condition',
        // Apply one bleed on placement, then ten more at one-second intervals.
        ticks: Array.from({ length: 11 }, (_, index) => ({
          atMs: index * 1000,
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 10
        }))
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: index * 1000,
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 2
        }))
      }
    ])
  },
  [ID.SPIDER_VENOM]: {
    name: 'Spider Venom',
    description: 'Venom. Poison foes with your next few attacks.',
    icon: 'https://render.guildwars2.com/file/39320C2D4AED963861F4540F59AEBB5E05AD2E1C/103513.png',
    type: 'Utility',
    slot: 'Utility',

    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 30,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'buff',
        name: 'spider-venom',
        kind: 'spider-venom',
        duration: 24,
        stacks: 6,
        audience: { recipients: RECIPIENT.PARTY }
      }
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'thief.activate-venom',
          id: 'venom',
          effects: [
            { type: 'condition', name: CONDITION.POISONED, condition: CONDITION.POISONED, stacks: 1, duration: 3 }
          ]
        }
      }
    ]
  },
  [ID.BLINDING_POWDER]: {
    name: 'Blinding Powder',
    description: 'Deception. Blind nearby foes and grant stealth to nearby allies.',
    icon: 'https://render.guildwars2.com/file/A50FF4564443B9C436E2354762D6077AB0C63746/103113.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Deception',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 20,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.stealth' } }]
  },
  [ID.ASSASSINS_SIGNET]: {
    name: "Assassin's Signet",
    description:
      'Signet Passive: Grants increased power.\nSignet Active: Power is massively increased for a short duration.',
    icon: 'https://render.guildwars2.com/file/16BAE223E268B19ABFE66040F11706B7BC00EF79/104076.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Signet',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    attributeBonuses: { power: 180 },
    activePowerBonus: 540,
    duration: 5,
    cooldown: 20,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [],
    // Activate only after recharge settlement.
    sideEffects: [...SIGNET_COMPLETED, { on: 'castCommit', do: { type: 'thief.assassins-signet' } }]
  },
  [ID.SIGNET_OF_MALICE]: {
    name: 'Signet of Malice',
    description: 'Signet Passive: Heals when you attack.\nSignet Active: Gain health.',
    icon: 'https://render.guildwars2.com/file/D6640348CA7573A86818B9B4B00F0C0CC2FF5FDF/104077.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Signet',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 12,
    initiativeCost: 0,
    castTimeMs: 200,
    effects: [],
    sideEffects: SIGNET_COMPLETED
  },
  [ID.SKALE_VENOM]: {
    name: 'Skale Venom',
    description: 'Venom. Apply vulnerability and torment with your next few attacks.',
    icon: 'https://render.guildwars2.com/file/A71B05C116B677EF620780B3D5BC58287EBC6D4B/104078.png',
    type: 'Utility',
    slot: 'Utility',

    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 30,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'buff',
        name: 'skale-venom',
        kind: 'skale-venom',
        duration: 24,
        stacks: 4,
        audience: { recipients: RECIPIENT.PARTY }
      }
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'thief.activate-venom',
          id: 'venom',
          effects: [
            {
              type: 'condition',
              name: CONDITION.VULNERABILITY,
              condition: CONDITION.VULNERABILITY,
              stacks: 1,
              duration: 10
            },
            { type: 'condition', name: CONDITION.TORMENT, condition: CONDITION.TORMENT, stacks: 1, duration: 3 }
          ]
        }
      }
    ]
  },
  [ID.PREPARE_PITFALL]: {
    name: 'Prepare Pitfall',
    description:
      'Preparation. Mark your current area with controlling magic, readying the location to crush enemies when Pitfall is released.',
    icon: 'https://render.guildwars2.com/file/7A6E5D360EC09AB9FCCA4098A9EB9A80DC33C7BE/2175064.png',
    type: 'Utility',
    slot: 'Utility',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 25,
    rechargeAnchor: 'castStart',
    initiativeCost: 0,
    duration: 3,
    castTimeMs: 360,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.prepare-trap' } }]
  },
  [ID.SIGNET_OF_AGILITY]: {
    name: 'Signet of Agility',
    description:
      'Signet Passive: Grants increased precision.\nSignet Active: Refill endurance and cleanse conditions from nearby allies.',
    icon: 'https://render.guildwars2.com/file/EBE194955CE4A25AD7B9D85EA6260CF8FD54ED0C/104081.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Signet',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    attributeBonuses: { precision: 180 },
    enduranceGain: 100,
    cooldown: 30,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [],
    // The active grant commits once and uses the selected skill.
    sideEffects: [
      ...SIGNET_COMPLETED,
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          resource: 'endurance',
          amount: { skillField: 'enduranceGain' }
        }
      }
    ]
  },
  [ID.INFILTRATORS_SIGNET]: {
    name: "Infiltrator's Signet",
    description:
      'Signet Passive: Regenerates one extra initiative every ten seconds.\nSignet Active: Shadowstep to your foe.',
    icon: 'https://render.guildwars2.com/file/1348ADE06365503C356713C2C9A3E61BB17CCFD0/103712.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Signet',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    // The active shadowstep participates in movement traits and relic triggers.
    movementSkill: true,
    shadowstepSkill: true,
    cooldown: 20,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [],
    // Activate only after recharge settlement.
    sideEffects: [...SIGNET_COMPLETED, { on: 'castCommit', do: { type: 'thief.restart-signet' } }]
  },
  [ID.HASTE]: {
    name: 'Haste',
    description: 'Trick. Gain quickness, fury, and swiftness.',
    icon: 'https://render.guildwars2.com/file/1C7719C3046D06161D071C0A6B33D3C8179E3F67/103459.png',
    type: 'Utility',
    slot: 'Utility',

    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 20,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.QUICKNESS,
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.THIEVES_GUILD]: {
    name: 'Thieves Guild',
    description: 'Deception. Call more thieves to support you in combat.',
    icon: 'https://render.guildwars2.com/file/C314B19D687453E02BC5B5BB4137903A12267AF1/104093.png',
    type: 'Elite',
    slot: 'Elite',
    skillFamily: 'Deception',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 120,
    initiativeCost: 0,
    // Lifetime belongs to the summon; actor attributes and stream startup remain shared policy.
    duration: 24,
    summonAttack: {
      basePower: 1750,
      criticalChance: 0.2,
      criticalDamage: 1.5,
      summons: [
        {
          name: 'Male Dual-Pistol Thief',
          displayName: 'Thief',
          weapon: 'Pistol',
          weaponStrengthProfileId: 'weapon.pistol',
          attacks: [
            {
              skillId: 3669,
              initialDelay: 1.44
            },
            {
              skillId: 3666,
              initialDelay: 3.56
            }
          ]
        },
        {
          name: 'Female Dual-Dagger Thief',
          displayName: 'Thief',
          weapon: 'Dagger',
          weaponStrengthProfileId: 'weapon.dagger',
          attacks: [
            {
              skillId: 3665,
              initialDelay: 1.72
            },
            {
              skillId: 3661,
              initialDelay: 2.52
            },
            {
              skillId: 3662,
              initialDelay: 3.08
            },
            {
              skillId: 3663,
              initialDelay: 3.72
            }
          ]
        },
        {
          name: 'Sword Thief',
          displayName: 'Thief',
          variant: 'Core Thief',
          weapon: 'Sword',
          weaponStrengthProfileId: 'weapon.sword',
          attacks: [
            {
              skillId: 'thief.guild.core.basic',
              initialDelay: 1
            }
          ]
        }
      ]
    },
    castTimeMs: 1000,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.summon-guild' } }]
  },
  [ID.DAGGER_STORM]: {
    name: 'Dagger Storm',
    description:
      'Trick. Spin around, reflecting projectiles and throwing daggers that cripple and bleed nearby foes. You can move while spinning.',
    icon: 'https://render.guildwars2.com/file/A3EDB565CBE71208A3F5B2A26063A4DC80389DF6/103120.png',
    type: 'Elite',
    slot: 'Elite',

    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 60,
    initiativeCost: 0,
    castTimeMs: 1840,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.33,
        hits: 1,
        name: 'Dagger Storm',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 2,
        duration: 7,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.DEVOURER_VENOM]: {
    name: 'Devourer Venom',
    description: 'Venom. Your next few attacks immobilize foes.',
    icon: 'https://render.guildwars2.com/file/C9A1784C4333E851F69AC53BC6E1EE1FF5FEB577/104097.png',
    type: 'Utility',
    slot: 'Utility',

    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 40,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'buff',
        name: 'devourer-venom',
        kind: 'devourer-venom',
        duration: 24,
        stacks: 2,
        audience: { recipients: RECIPIENT.PARTY }
      }
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'thief.activate-venom',
          id: 'venom',
          effects: [
            { type: 'condition', name: CONDITION.IMMOBILIZED, condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 1 }
          ]
        }
      }
    ]
  },
  [ID.BASILISK_VENOM]: {
    name: 'Basilisk Venom',
    description: 'Venom. Your attacks are unblockable and turn foes to stone.',
    icon: 'https://render.guildwars2.com/file/535F5CFC1D9C09F437A3B05F39CFD044434CDDBC/104109.png',
    type: 'Elite',
    slot: 'Elite',

    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 40,
    initiativeCost: 0,
    castTimeMs: 680,
    // Model only its control contribution on activation; venom sharing and on-hit charges are intentionally omitted.
    effects: [{ type: 'control', controlKind: CONTROL.STUN, atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }]
  },
  [ID.SKELK_VENOM]: {
    name: 'Skelk Venom',
    description: 'Venom. Heal yourself. Your next few attacks heal you.',
    icon: 'https://render.guildwars2.com/file/076DD1A71BE0B3474FC6516CC0ECE439BEAF9059/699532.png',
    type: 'Heal',
    slot: 'Heal',

    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 25,
    initiativeCost: 0,
    castTimeMs: 680,
    effects: []
  },
  [ID.PITFALL]: {
    name: 'Pitfall',
    description: 'Unleash your pitfall on the area, knocking down foes and delivering constant damage over time.',
    icon: 'https://render.guildwars2.com/file/0C389DB2BC595179D1BBB2C05BBF460753913567/2175063.png',
    type: 'Utility',
    slot: 'Utility',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 3,
    initiativeCost: 0,
    castTimeMs: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.25 }],
        name: 'Initial Impact Damage',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          ticks: PITFALL_PULSE_OFFSETS_MS.map((atMs) => ({ atMs, coefficient: 0.5 })),
          name: 'Pulse Damage',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          ticks: PITFALL_PULSE_OFFSETS_MS.map((atMs) => ({
            atMs,
            condition: CONDITION.VULNERABILITY,
            stacks: 2,
            duration: 6
          })),
          actorType: ACTOR.PLAYER
        },
        {
          type: 'control',
          atMs: 0,
          actorType: ACTOR.PLAYER,
          controlKind: CONTROL.KNOCKDOWN
        }
      ])
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.activate-trap' } }]
  },
  [ID.THOUSAND_NEEDLES]: {
    name: 'Thousand Needles',
    description:
      'Unleash a hail of needles that immobilizes enemies on impact and poisons the ground, inflicting conditions over time.',
    icon: 'https://render.guildwars2.com/file/2E9B1FD2687F76E4CDF00ADF04B6AB07CE7CD880/2175069.png',
    type: 'Utility',
    slot: 'Utility',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [{ atMs: THOUSAND_NEEDLES_INITIAL_DELAY_MS, coefficient: 0.5 }],
        name: 'Thousand Needles — Initial Strike'
      },
      {
        type: 'strike',
        ticks: [
          THOUSAND_NEEDLES_INITIAL_DELAY_MS + 1000,
          THOUSAND_NEEDLES_INITIAL_DELAY_MS + 2000,
          THOUSAND_NEEDLES_INITIAL_DELAY_MS + 3000,
          THOUSAND_NEEDLES_INITIAL_DELAY_MS + 4000
        ].map((atMs) => ({ atMs, coefficient: 0.2 })),
        name: 'Thousand Needles — Pulse'
      },
      {
        type: 'condition',
        ticks: [{ atMs: THOUSAND_NEEDLES_INITIAL_DELAY_MS, condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 3 }]
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: THOUSAND_NEEDLES_INITIAL_DELAY_MS + index * 1000,
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 8
        }))
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: THOUSAND_NEEDLES_INITIAL_DELAY_MS + index * 1000,
          condition: CONDITION.BLEEDING,
          stacks: 2,
          duration: 5
        }))
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: THOUSAND_NEEDLES_INITIAL_DELAY_MS + index * 1000,
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 2
        }))
      }
    ]),
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.activate-trap' } }]
  }
});

const THIEF_INFILTRATORS_SIGNET_PULSE = 'thief.infiltrators-signet';

/** Activation and resets start a full interval after readiness; suppression does not credit future initiative. */
function nextInfiltratorsSignetPulse(runtime: ThiefRuntime): number {
  return selectedSkillIdSet(runtime.config.selectedSkillIds).has(ID.INFILTRATORS_SIGNET)
    ? Math.max(runtime.time, runtime.cooldownController.readyAt(ID.INFILTRATORS_SIGNET) ?? 0) + 10
    : Infinity;
}

const infiltratorsSignetPassive = definePeriodicTask<ThiefRuntime>({
  name: THIEF_INFILTRATORS_SIGNET_PULSE,
  background: true,
  priority: 0,
  state: (runtime) => runtime.profession.core.infiltratorsSignetPassive,
  nextAt: nextInfiltratorsSignetPulse,
  run(runtime) {
    if ((runtime.cooldownController.readyAt(ID.INFILTRATORS_SIGNET) ?? 0) <= runtime.time)
      runtime.resourceController.grant('initiative', 1);
  }
});

function restartThiefInfiltratorsSignet(runtime: ThiefRuntime): void {
  infiltratorsSignetPassive.restart(runtime, nextInfiltratorsSignetPulse(runtime));
}

/** The signet owns its passive cadence across activation, cancellation, and cooldown resets. */
export const infiltratorsSignetLifecycle = {
  ...infiltratorsSignetPassive.hooks,
  initialize: restartThiefInfiltratorsSignet,
  sideEffectHandlers: { 'thief.restart-signet': restartThiefInfiltratorsSignet },
  onCastCancel(runtime, cast) {
    // Restart only after the cancelled signet's recharge has settled.
    if (cast.skill.id === ID.INFILTRATORS_SIGNET) restartThiefInfiltratorsSignet(runtime);
  },
  onCooldownReset: restartThiefInfiltratorsSignet
} satisfies RuntimeHooks<ThiefRuntimeState, ThiefSkill>;
