/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { conditionTimeline, impactEffects, strikeTimeline } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

export const NECROMANCER_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.LIFE_BLAST]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'death',
    shroudSlot: 1,
    specialization: '',
    flipSkillId: null,
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
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'death',
    shroudSlot: 1,
    specialization: '',
    flipParentId: null,
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
    // Dark Pursuit stays available briefly after the claw lands.
    flipDuration: 3,
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'death',
    shroudSlot: 2,
    specialization: '',
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
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'death',
    shroudSlot: 2,
    specialization: '',
    cooldown: 0,
    castTimeMs: 0,
    effects: [],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.DARK_PURSUIT } }]
  },
  [ID.DOOM]: {
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'death',
    shroudSlot: 3,
    specialization: '',
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
    type: 'Profession',
    slot: 'Weapon_4',
    shroud: 'death',
    shroudSlot: 4,
    specialization: '',
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
    type: 'Profession',
    slot: 'Weapon_5',
    shroud: 'death',
    shroudSlot: 5,
    specialization: '',
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
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
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
    castTimeMs: 0,
    effects: [],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.MARCH_OF_UNDEATH } }]
  },
  [ID.SUMMON_MADNESS]: {
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
