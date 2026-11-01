/** Canonical Core necromancer skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

// Sword follow-ups remain available for their measured reactivation window.
const OFF_HAND_SWORD_FOLLOW_UP_WINDOW_SECONDS = 3;

export const NECROMANCER_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.ENERVATION_BLADE]: {
    name: 'Enervation Blade',
    description:
      'Chain. Fire a wide piercing projectile from your blade. Heal if a target is struck. Healing is reduced for each target beyond the first.',
    icon: 'https://render.guildwars2.com/file/23AE69737F07D92B98E642F990FF78F0444207DD/3256365.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1
      }
    ]
  },
  [ID.ENERVATION_ECHO]: {
    name: 'Enervation Echo',
    description: 'Chain. Fire another wide piercing projectile from your blade.',
    icon: 'https://render.guildwars2.com/file/DF233EEC58CB475E2337E02F914301AE15C15C39/3256366.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1
      }
    ]
  },
  [ID.DEATHLY_ENERVATION]: {
    name: 'Deathly Enervation',
    description: 'Chain. Fire an even wider piercing projectile that inflicts chill.',
    icon: 'https://render.guildwars2.com/file/BFA0E4195377F050BF47FB490F5F920B4FA85DF5/3256367.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 2
      }
    ]
  },
  [ID.RAVENOUS_WAVE]: {
    name: 'Ravenous Wave',
    description:
      'Send a wave of necrotic energy cascading toward your target. Gain life force if you hit an enemy. Reactivate this skill to inflict additional damage on all targets hit by the wave.',
    icon: 'https://render.guildwars2.com/file/685D7C55F702B7BE66FC19AA282D7BC9DBBF17FC/3256368.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_2',
    cooldown: 6,
    flipDuration: 3,
    castTimeMs: 400,
    effects: [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 12 } })
          }
        ],
        coefficient: 2,
        hits: 1
      }
    ],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.weapon-flip' } }]
  },
  [ID.SATIATE]: {
    name: 'Satiate',
    description:
      'Sacrifice health to inflict additional damage on all targets hit by the wave, dealing additional damage to targets below the health threshold.',
    icon: 'https://render.guildwars2.com/file/D6AA00E24B2C496E2DB92251AE7A411E0F244690/3256369.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_2',
    cooldown: 0,
    castTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        coefficientModifiers: [
          {
            kind: 'target-health-below',
            threshold: 0.5,
            multiplier: 1.5
          }
        ]
      }
    ],
    // Successful follow-up commitment consumes only this weapon window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.SATIATE } }]
  },
  [ID.PATH_OF_GLUTTONY]: {
    name: 'Path of Gluttony',
    description:
      'Dash forward, releasing dark energy on nearby targets. Damage enemies hit and heal per target hit with reduced healing beyond the first. This skill can be reactivated to dash again.',
    icon: 'https://render.guildwars2.com/file/4259799ECC5640CB0DBC6DFED60E0B5D140297AC/3256370.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_3',
    cooldown: 10,
    castTimeMs: 760,
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: COMBO_FINISHER.LEAP
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ],
    // With no shorter flipDuration, Gorge remains available for this parent's selected cooldown.
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.weapon-flip' } }]
  },
  [ID.GORGE]: {
    name: 'Gorge',
    description: 'Sacrifice health to dash again. Corrupt boons on enemies struck.',
    icon: 'https://render.guildwars2.com/file/924E08025BF00C127049DE5C6A27B534EB093819/3256371.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_3',
    cooldown: 0,
    castTimeMs: 760,
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: COMBO_FINISHER.LEAP
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ],
    // Successful follow-up commitment consumes only this weapon window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.GORGE } }]
  },
  [ID.HUNGERING_MAELSTROM]: {
    name: 'Hungering Maelstrom',
    description:
      'Create a dark maelstrom that deals damage, inflicts vulnerability, and steals health. Reactivate this skill to inflict additional damage and conditions on all targets hit by the maelstrom.',
    icon: 'https://render.guildwars2.com/file/BD32043A63C3B2D84CB23D013F54BAAD477FC2EC/3256372.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_4',
    cooldown: 16,
    flipDuration: OFF_HAND_SWORD_FOLLOW_UP_WINDOW_SECONDS,
    castTimeMs: 640,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2.75 },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 5, duration: 8 }
    ]),
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.weapon-flip' } }]
  },
  [ID.GORMANDIZE]: {
    name: 'Gormandize',
    description: 'Sacrifice health to inflict additional damage and conditions on all targets hit by the maelstrom.',
    icon: 'https://render.guildwars2.com/file/7C0905345815665103A9C5516B7CD70F58D38070/3256373.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_4',
    cooldown: 0,
    castTimeMs: 440,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2.5 },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 5 },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 5, duration: 8 }
    ]),
    // Successful follow-up commitment consumes only this weapon window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.GORMANDIZE } }]
  },
  [ID.DEVOURING_VISAGE]: {
    name: 'Devouring Visage',
    description:
      'Fire an orb of death magic that explodes on impact, inflicting fear on enemies. Gain life force for each target struck. Reactivate this skill to drain the strength of all enemies struck by the explosion.',
    icon: 'https://render.guildwars2.com/file/01ABFE520BA87F34DA28D3AA0D2D40CF1CDDAE08/3256374.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_5',
    cooldown: 20,
    flipDuration: OFF_HAND_SWORD_FOLLOW_UP_WINDOW_SECONDS,
    castTimeMs: 680,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 10 } })
          }
        ],
        coefficient: 1.5
      },
      {
        type: 'condition',
        condition: CONDITION.FEAR,
        stacks: 1,
        duration: 2
      }
    ]),
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.weapon-flip' } }]
  },
  [ID.CONSUME]: {
    name: 'Consume',
    description:
      'Sacrifice health to drain the strength of your enemies, inflicting weakness while granting might to yourself for each target affected.',
    icon: 'https://render.guildwars2.com/file/66912215141AD753D6080FB6FBC30F0E7AE9B1FE/3256375.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_5',
    cooldown: 0,
    castTimeMs: 520,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 480 + index * 280, coefficient: 2.5 / 5 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      ...impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 4 },
        { type: 'boon', boon: BOON.MIGHT, duration: 8, stacks: 5 }
      ])
    ],
    // Successful follow-up commitment consumes only this weapon window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.CONSUME } }]
  }
});
