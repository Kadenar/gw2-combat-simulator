/** Canonical Core necromancer skill definitions grouped by their GW2 owner. */
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { conditionTimeline, impactEffects, strikeTimeline } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

export const NECROMANCER_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.LIFE_BLAST]: {
    name: 'Life Blast',
    description: 'Shroud. Blast your foe with life force.',
    icon: 'https://render.guildwars2.com/file/E163E6D4B3E0DE946C00002526947BA20B542D40/103260.png',
    cooldown: 0,
    skillWeapon: 'Hammer',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'death',
    shroudSlot: 1,
    castTimeMs: 920,
    effects: [
      {
        weaponStrengthProfileId: 'transform.death-shroud',
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      }
    ]
  },
  [ID.DEATH_SHROUD]: {
    name: 'Death Shroud',
    description: 'Assume a spectral form and gain new skills, turning your life force into health.',
    icon: 'https://render.guildwars2.com/file/01B603B6CE41416CD0582AAC1D3A33DE3E086BFA/103298.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 10,
    shroudEntry: 'death',
    // Core drain belongs to the entry skill; elite entries select their minor trait.
    shroudTuning: { kind: 'skill', id: ID.DEATH_SHROUD },
    lifeForceDrain: 3,
    minimumShroudLifeForcePercent: 10,
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/forms.ts` and `core/mechanics/resources.ts`.
    inputCategory: 'bar-swap',
    castTimeMs: 0,
    effects: [],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.enter-shroud' } }]
  },
  [ID.END_DEATH_SHROUD]: {
    name: 'End Death Shroud',
    description: 'Leave Death Shroud and return to your normal form.',
    icon: 'https://render.guildwars2.com/file/B0B702D80CAAEF7AF1010B716C730B920E632B0D/103817.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 0,
    shroudExit: 'death',
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/forms.ts` and `core/mechanics/resources.ts`.
    inputCategory: 'bar-swap',
    castTimeMs: 0,
    effects: [],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.exit-shroud' } }]
  },
  [ID.DHUUMFIRE_BLAST]: {
    name: 'Dhuumfire',
    description: 'Blast your foe with life force, setting them alight.',
    icon: 'https://render.guildwars2.com/file/E163E6D4B3E0DE946C00002526947BA20B542D40/103260.png',
    cooldown: 0,
    skillWeapon: 'Hammer',
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'death',
    shroudSlot: 1,
    simulatorExcluded: true,
    castTimeMs: 920,
    effects: [
      {
        weaponStrengthProfileId: 'transform.death-shroud',
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 3
      }
    ]
  },
  [ID.DARK_PATH]: {
    name: 'Dark Path',
    description: 'Shroud. Send out a claw that damages, bleeds, and chills the target.',
    icon: 'https://render.guildwars2.com/file/10773D150F72F5BEF252D06EB7DC2C040A5202A3/2175061.png',
    cooldown: 8,
    skillWeapon: 'Hammer',
    // Dark Pursuit stays available briefly after the claw lands.
    flipDuration: 3,
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'death',
    shroudSlot: 2,
    castTimeMs: 880,
    effects: [
      {
        weaponStrengthProfileId: 'transform.death-shroud',
        type: 'strike',
        coefficient: 0.25,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 2,
        duration: 8
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 3
      }
    ],
    // A completed cast arms the authored follow-up duration through the common flip owner.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.DARK_PURSUIT } }]
  },
  [ID.DARK_PURSUIT]: {
    name: 'Dark Pursuit',
    description: 'Shadowstep to the foe marked by Dark Path.',
    icon: 'https://render.guildwars2.com/file/1063CD31245E30A20662042B5EB7375C9CCAF5A5/2175062.png',
    skillWeapon: 'Hammer',
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'death',
    shroudSlot: 2,
    cooldown: 0,
    castTimeMs: 0,
    effects: [],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.DARK_PURSUIT } }]
  },
  [ID.DOOM]: {
    name: 'Doom',
    description: 'Shroud. Damage and fear your target.',
    icon: 'https://render.guildwars2.com/file/6CAB0D17DF604E5C6330523A350EC4430409A309/103818.png',
    cooldown: 20,
    skillWeapon: 'Hammer',
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'death',
    shroudSlot: 3,
    castTimeMs: 600,
    effects: [
      {
        weaponStrengthProfileId: 'transform.death-shroud',
        type: 'strike',
        coefficient: 0.1,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.FEAR,
        stacks: 1,
        duration: 2
      }
    ]
  },
  [ID.LIFE_TRANSFER]: {
    name: 'Life Transfer',
    description: 'Shroud. Channel damage around you and gain life force per strike.',
    icon: 'https://render.guildwars2.com/file/579400360B6E0C9D699B5D6D0AC9F2184CC707F8/103820.png',
    cooldown: 20,
    skillWeapon: 'Hammer',
    type: 'Profession',
    slot: 'Weapon_4',
    shroud: 'death',
    shroudSlot: 4,
    castTimeMs: 2920,
    // Snap each original 222 ms pulse independently to 40 ms, keeping strikes and bleeding synchronized.
    // Group bleeding applications in one timeline while retaining their shared strike timing.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        weaponStrengthProfileId: 'transform.death-shroud',
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 9 } })
          }
        ],
        ticks: [240, 440, 680, 880, 1120, 1320, 1560, 1760, 2000].map((atMs) => ({ atMs, coefficient: 3.825 / 9 }))
      },
      conditionTimeline(
        [240, 440, 680, 880, 1120, 1320, 1560, 1760, 2000].map((atMs) => ({
          atMs,
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 3
        }))
      )
    ])
  },
  [ID.TAINTED_SHACKLES]: {
    name: 'Tainted Shackles',
    description: 'Shroud. Bind nearby enemies, pulsing torment before the binding strikes.',
    icon: 'https://render.guildwars2.com/file/CBEB3C180F343DC0CBA9BD5A3E09642C1D73599C/598947.png',
    cooldown: 25,
    skillWeapon: 'Hammer',
    type: 'Profession',
    slot: 'Weapon_5',
    shroud: 'death',
    shroudSlot: 5,
    castTimeMs: 200,
    // Align the delayed torment and final strike to 40 ms without shifting the cast-scaled opening pulse.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'condition',
        ticks: [{ atMs: 200, condition: CONDITION.TORMENT, stacks: 2, duration: 12 }],
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1240, condition: CONDITION.TORMENT, stacks: 2, duration: 12 }]
      },
      {
        type: 'condition',
        ticks: [{ atMs: 2240, condition: CONDITION.TORMENT, stacks: 2, duration: 12 }]
      },
      {
        type: 'condition',
        ticks: [{ atMs: 3240, condition: CONDITION.TORMENT, stacks: 2, duration: 12 }]
      },
      {
        weaponStrengthProfileId: 'transform.death-shroud',
        type: 'strike',
        ticks: [{ atMs: 4240, coefficient: 1.25 }]
      },
      {
        // Binding immobilizes only with the final impact, after the four-second tether (wiki: Tainted_Shackles).
        type: 'condition',
        ticks: [{ atMs: 4240, condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 2 }]
      }
    ])
  },
  [ID.DEATHLY_CLAWS]: {
    name: 'Deathly Claws',
    description: 'Lich Form. Send grasping claws through your foes.',
    icon: 'https://render.guildwars2.com/file/0232367CBDA026CD9B00B5E97D312F2CF2E0551F/103836.png',
    type: 'Profession',
    slot: 'Weapon_1',

    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 760,
    effects: [
      {
        type: 'strike',
        coefficient: 2.34,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 3,
        duration: 3
      }
    ]
  },
  [ID.LICHS_GAZE]: {
    name: "Lich's Gaze",
    description: 'Lich Form. Fire an unblockable projectile that chills and corrupts boons.',
    icon: 'https://render.guildwars2.com/file/0E5873900C7F43F3DFC394494D0AD90959CECA22/1770531.png',
    type: 'Profession',
    slot: 'Weapon_2',

    cooldown: 8,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 4
      }
    ]
  },
  [ID.RIPPLE_OF_HORROR]: {
    name: 'Ripple of Horror',
    description: 'Lich Form. Launch a damaging wave that fears foes it crosses.',
    icon: 'https://render.guildwars2.com/file/3D4622D7D8C6163E9FE4FBD50E01ED215AD0EE2B/1770530.png',
    type: 'Profession',
    slot: 'Weapon_3',

    cooldown: 15,
    flipDuration: 12,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.FEAR,
        stacks: 1,
        duration: 2
      }
    ],
    // A completed cast arms the authored follow-up duration through the common flip owner.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.MARCH_OF_UNDEATH } }]
  },
  [ID.MARCH_OF_UNDEATH]: {
    name: 'March of Undeath',
    description: 'Lich Form. Shadowstep to your Ripple of Horror.',
    icon: 'https://render.guildwars2.com/file/6728BBF7042B554E3D3996C1721501FF16E4F661/1770529.png',
    type: 'Profession',
    slot: 'Weapon_3',

    cooldown: 12,
    castTimeMs: 0,
    effects: [],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.MARCH_OF_UNDEATH } }]
  },
  [ID.SUMMON_MADNESS]: {
    name: 'Summon Madness',
    description: 'Lich Form. Repeatedly summon unstable horrors that attack and explode.',
    icon: 'https://render.guildwars2.com/file/590CC70C1003DC0F3C6498E8BED4FF0765CA1E72/103716.png',
    type: 'Profession',
    slot: 'Weapon_4',

    cooldown: 30,
    summons: 8,
    summonInterval: 1,
    // Creature lifetime survives removal of an attack or explosion from the selected profile.
    summonDuration: 6,
    castTimeMs: 1000,
    // Anchor the horror's attack and explosion to cast completion with fixed delays.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 0.33 }],
        actorType: ACTOR.SUMMON,
        packetLabel: 'attack',
        name: 'Unstable Horror - Attack'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 6000, coefficient: 1.25 }],
        actorType: ACTOR.SUMMON,
        packetLabel: 'explosion',
        name: 'Unstable Horror - Explosion'
      }
    ]),
    effectVariants: [{ when: () => true, transform: () => [] }],
    // Commitment invokes the shared creature owner once; it retains command and generation lifetimes.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.summon-horrors' } }]
  },
  [ID.GRIM_SPECTER]: {
    name: 'Grim Specter',
    description: 'Lich Form. Siphon life from nearby enemies over time.',
    icon: 'https://render.guildwars2.com/file/A6CAF2146D9DF2EBEFD9285CB0E9E3617A659071/1770528.png',
    type: 'Profession',
    slot: 'Weapon_5',

    cooldown: 30,
    castTimeMs: 520,
    // Keep the cast-scaled opening siphon separate from the fixed delayed pulse timeline.
    effects: [
      strikeTimeline([{ atMs: 520, coefficient: 0 }], {
        name: 'Grim Specter — Life Steal',
        flatStrikeBase: 778,
        flatStrikePowerCoeff: 0.2,
        canCrit: false,
        damageKind: 'life-steal',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }),
      strikeTimeline(
        [1760, 2760, 3760, 4760].map((atMs) => ({ atMs, coefficient: 0 })),
        {
          name: 'Grim Specter — Delayed Life Steal',
          flatStrikeBase: 778,
          flatStrikePowerCoeff: 0.2,
          canCrit: false,
          damageKind: 'life-steal',
          timingAnchor: 'castStart',
          timingScale: 'fixed'
        }
      )
    ]
  }
});
