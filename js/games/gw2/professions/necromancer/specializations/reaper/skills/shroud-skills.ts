/**
 * Owns Reaper Shroud entry, exit, and weapon skill definitions.
 * Shroud attribute modifiers live in `modifiers.ts`; shroud state and reactions live in `hooks.ts` and `mechanics/shroud-effects.ts`.
 */
import { ACTOR, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

/** Supplies Reaper Shroud definitions to specialization composition. */
export const REAPER_SHROUD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.LIFE_REND]: {
    name: 'Life Rend',
    description: 'Chain. Shroud. Cleave foes in front of you. This skill inherits traits from Life Blast.',
    icon: 'https://render.guildwars2.com/file/59F9500BD4CABD990B6C4E68A458805268A1941A/1012933.png',
    cooldown: 0,
    skillWeapon: 'Hammer',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'reaper',
    shroudSlot: 1,
    castTimeMs: 400,
    effects: [
      {
        weaponStrengthProfileId: 'transform.reaper-shroud',
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      }
    ]
  },
  [ID.LIFE_SLASH]: {
    name: 'Life Slash',
    description: 'Chain. Shroud. Cleave foes in front of you again. This skill inherits traits from Life Blast.',
    icon: 'https://render.guildwars2.com/file/37FF121D3DF16CA847D1163CACBC673F575C927E/1012931.png',
    cooldown: 0,
    skillWeapon: 'Hammer',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'reaper',
    shroudSlot: 1,
    castTimeMs: 600,
    effects: [
      {
        weaponStrengthProfileId: 'transform.reaper-shroud',
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1.6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.LIFE_REAP]: {
    name: 'Life Reap',
    description:
      'Shroud. Cleave foes around you, gaining life force for each foe struck. This skill inherits traits from Life Blast.',
    icon: 'https://render.guildwars2.com/file/6DD6D4C7E7B62A75629D260279CC570BCD33C6AA/1012932.png',
    cooldown: 0,
    skillWeapon: 'Hammer',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'reaper',
    shroudSlot: 1,
    castTimeMs: 560,
    interruptCommitMs: 360,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        weaponStrengthProfileId: 'transform.reaper-shroud',
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 1.5 } })
          }
        ],
        ticks: [{ atMs: 280, coefficient: 1.8 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.DEATHS_CHARGE]: {
    name: "Death's Charge",
    description:
      'Shroud. Slide forward, destroying projectiles in your path. Blind foes at your destination. This skill inherits traits from Dark Path.',
    icon: 'https://render.guildwars2.com/file/B83E6592FE92D10FF73CEB6F4FF5A5F0907F7D4F/1012934.png',
    cooldown: 6,
    skillWeapon: 'Hammer',
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'reaper',
    shroudSlot: 2,
    castTimeMs: 1200,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: [
      {
        weaponStrengthProfileId: 'transform.reaper-shroud',
        type: 'strike',
        ticks: [
          { atMs: 40, coefficient: 0.25 },
          { atMs: 160, coefficient: 0.25 },
          { atMs: 280, coefficient: 0.25 },
          { atMs: 400, coefficient: 0.25 },
          { atMs: 520, coefficient: 0.25 },
          { atMs: 640, coefficient: 0.25 },
          { atMs: 760, coefficient: 0.25 },
          { atMs: 880, coefficient: 0.25 },
          { atMs: 960, coefficient: 0.25 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      ...impactEffects({ atMs: 1160, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          weaponStrengthProfileId: 'transform.reaper-shroud',
          type: 'strike',
          coefficient: 1.625,
          name: "Death's Charge — Final Strike"
        },
        {
          type: 'condition',
          condition: CONDITION.BLINDNESS,
          stacks: 1,
          duration: 3
        }
      ])
    ]
  },
  [ID.INFUSING_TERROR]: {
    name: 'Infusing Terror',
    description:
      'Shroud. Shroud yourself with dark armor that grants stability and reduces incoming damage. While the armor is active, you may reactivate this skill to inflict fear on foes around you.',
    icon: 'https://render.guildwars2.com/file/9D599AB94261527E79969E35AB6519D9C0396102/1012935.png',
    cooldown: 25,
    skillWeapon: 'Hammer',
    flipDuration: 6,
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'reaper',
    shroudSlot: 3,
    castTimeMs: 0,
    effects: [],
    // A completed cast arms the authored follow-up duration through the common flip owner.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.TERRIFY } }]
  },
  [ID.TERRIFY]: {
    name: 'Terrify',
    description: 'Shroud. Make foes around you flee in fear.',
    icon: 'https://render.guildwars2.com/file/780206747069014A400CE6D9922AF5E81EAAA52C/1012936.png',
    skillWeapon: 'Hammer',
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'reaper',
    shroudSlot: 3,
    cooldown: 0,
    castTimeMs: 320,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.FEAR,
        stacks: 1,
        duration: 1
      }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.TERRIFY } }]
  },
  [ID.SOUL_SPIRAL]: {
    name: 'Soul Spiral',
    description: 'Shroud. Spin and damage nearby foes, and inflict a condition each strike.',
    icon: 'https://render.guildwars2.com/file/4BFAEBD27404BDCB3A0255F1441560D3772F0CF5/1012937.png',
    cooldown: 30,
    skillWeapon: 'Hammer',
    type: 'Profession',
    slot: 'Weapon_4',
    shroud: 'reaper',
    shroudSlot: 4,
    castTimeMs: 2160,
    // Resolve Soul Spiral per packet so interruption keeps landed hits while cancelling only later packets.
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        weaponStrengthProfileId: 'transform.reaper-shroud',
        type: 'strike',
        comboFinishers: [
          {
            ownerId: 'necromancer',
            finisherType: COMBO_FINISHER.WHIRL,
            applications: 4
          }
        ],
        ticks: [240, 440, 560, 760, 880, 1080, 1200, 1400, 1520, 1720, 1840, 2040].map((atMs) => ({
          atMs,
          coefficient: 0.7
        }))
      },
      {
        type: 'condition',
        ticks: [240, 440, 560, 760, 880, 1080, 1200, 1400, 1520, 1720, 1840, 2040].map((atMs) => ({
          atMs,
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 2
        }))
      }
    ])
  },
  [ID.REAPERS_SHROUD]: {
    name: "Reaper's Shroud",
    description: 'Assume the form of a reaper and gain new skills, turning your life force into health.',
    icon: 'https://render.guildwars2.com/file/795CD8A855B81908E6D37DFE039DE25762DAAAE9/1012930.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 10,
    shroudEntry: 'reaper',
    shroudTuning: { kind: 'trait', id: TRAIT.SHROUD_KNIGHT },
    minimumShroudLifeForcePercent: 10,
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/forms.ts` and `core/mechanics/resources.ts`.
    inputCategory: 'bar-swap',
    castTimeMs: 0,
    effects: [],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.enter-shroud' } }]
  },
  [ID.EXECUTIONERS_SCYTHE]: {
    name: "Executioner's Scythe",
    description:
      'Shroud. Deliver a powerful overhand strike to stun a single target, dealing increased damage the lower their health. Leaves behind an ice field.',
    icon: 'https://render.guildwars2.com/file/3C3D986465B49F38A6DCB560E0E855A75D075EB6/1012938.png',
    cooldown: 30,
    skillWeapon: 'Hammer',
    type: 'Profession',
    slot: 'Weapon_5',
    shroud: 'reaper',
    shroudSlot: 5,
    castTimeMs: 1320,
    // The scythe commits after 920 ms, allowing its lingering Chill field to continue after interruption.
    interruptCommitMs: 920,
    // EVTC places the strike and first Chill at 840 ms, followed by four fixed one-second field pulses.
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: [
      ...impactEffects({ atMs: 840, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          weaponStrengthProfileId: 'transform.reaper-shroud',
          type: 'strike',
          coefficient: 4,
          comboFields: [{ ownerId: 'necromancer', fieldType: COMBO_FIELD.ICE, duration: 4 }],
          coefficientModifiers: [
            { kind: 'target-health-below', threshold: 0.25, multiplier: 2 },
            { kind: 'target-health-below', threshold: 0.5, multiplier: 1.5 }
          ]
        },
        { type: 'control', controlKind: CONTROL.STUN }
      ]),
      {
        type: 'condition',
        ticks: [840, 1840, 2840, 3840, 4840].map((atMs) => ({
          atMs,
          condition: CONDITION.CHILLED,
          stacks: 1,
          duration: 1
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.EXIT_REAPERS_SHROUD]: {
    name: "Exit Reaper's Shroud",
    description: "Leave Reaper's Shroud and return to your normal form.",
    icon: 'https://render.guildwars2.com/file/7D70A5084CD7BE0F90A016E159AAF1A2F8BD0AB4/1024104.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 0,
    shroudExit: 'reaper',
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/forms.ts` and `core/mechanics/resources.ts`.
    inputCategory: 'bar-swap',
    castTimeMs: 0,
    effects: [],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.exit-shroud' } }]
  }
});
