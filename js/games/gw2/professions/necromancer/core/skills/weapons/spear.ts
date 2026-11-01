/** Canonical Core necromancer skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

export const NECROMANCER_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.DARK_SLASH]: {
    name: 'Dark Slash',
    description: 'Chain. Slash your foes with your spear.',
    icon: 'https://render.guildwars2.com/file/62FAFB94710DF84D160BA0D371B06901A0DF6D06/3379159.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    interruptCommitMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 1.2 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.DEADLY_SLICE]: {
    name: 'Deadly Slice',
    description: 'Chain. Slice foes in front of you with your spear.',
    icon: 'https://render.guildwars2.com/file/05924CE123EE48985EC17F57A0E627263E576A31/3379160.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 520,
    interruptCommitMs: 480,
    effects: [
      {
        type: 'strike',
        // Only this selected application owns its accepted-impact reward.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: { type: 'necromancer.soul-shards', amount: 1 }
          }
        ],
        ticks: [{ atMs: 400, coefficient: 1.4 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.SINISTER_STAB]: {
    name: 'Sinister Stab',
    description: 'Chain. Stab foes and chill them. Gain a soul shard if you strike a foe.',
    icon: 'https://render.guildwars2.com/file/37E10170BBC70563DE1F0DF8CA66F11E28412860/3379161.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 560,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Only this selected application owns its accepted-impact reward.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 5 } })
          },
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: { type: 'necromancer.soul-shards', amount: 1 }
          }
        ],
        coefficient: 1.8
      },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 2 }
    ])
  },
  [ID.PERFORATE]: {
    name: 'Perforate',
    description:
      'Attack foes in front of you with a series of strikes, consuming any active soul shards. Deal additional damage against foes below the health threshold.',
    icon: 'https://render.guildwars2.com/file/A7A8BF413E59C060DA6BBE0DAE460C70DE01264A/3379162.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_2',
    cooldown: 8,
    // The measured Quickness cast ends one 40 ms action tick after its final packet.
    castTimeMs: 800,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        // Only this selected application owns its accepted-impact reward.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'each',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: { type: 'necromancer.perforate' }
          }
        ],
        ticks: [
          {
            atMs: 400,
            coefficient: 0.5
          },
          {
            atMs: 480,
            coefficient: 0.5
          },
          {
            atMs: 520,
            coefficient: 0.5
          },
          {
            atMs: 560,
            coefficient: 0.5
          },
          {
            atMs: 640,
            coefficient: 0.5
          },
          {
            atMs: 720,
            coefficient: 0.5
          },
          {
            atMs: 760,
            coefficient: 0.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        coefficientModifiers: [
          {
            kind: 'target-health-below',
            threshold: 0.5,
            multiplier: 1.2
          }
        ]
      }
    ]
  },
  [ID.ADDLE]: {
    name: 'Addle',
    description:
      'Daze your target and gain life force and soul shards. If your target is using a skill, the daze duration is extended and you gain additional life force and soul shards. If you have a number of soul shards above the threshold when you activate this skill, your target is also immobilized.',
    icon: 'https://render.guildwars2.com/file/9EC732C1EB4D50F2183C6D05250A0A6D993AA6D0/3379163.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_3',
    cooldown: 12,
    castTimeMs: 360,
    // Impact-only templates are selected by landed reactions, never ordinary cast emission.
    effects: [
      { type: 'control', name: 'Daze', controlKind: CONTROL.DAZE, packetLabel: 'on-hit' },
      {
        type: 'condition',
        name: CONDITION.IMMOBILIZED,
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 1.5,
        packetLabel: 'on-hit'
      },
      {
        type: 'strike',
        // Only this selected application owns its accepted-impact reward.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 10 } })
          },
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: {
              type: 'necromancer.addle-control'
            }
          },
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) =>
              Number(event.coefficient) > 0 && Boolean(event.metadata?.necromancerAddleImmobilize),
            do: {
              type: 'necromancer.addle-immobilize'
            }
          },
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (runtime, { event }) =>
              Number(event.coefficient) > 0 &&
              Boolean(runtime.config.target?.defiant || runtime.config.target?.activatingSkills),
            do: [
              lifeForceGrant({
                id: 'defiant-life-force',
                label: 'Additional life force against defiant or activating targets',
                unit: 'hit',
                grant: { percent: 10 }
              }),
              { type: 'necromancer.soul-shards', amount: 4 }
            ]
          },
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (runtime, { event }) =>
              Number(event.coefficient) > 0 &&
              !Boolean(runtime.config.target?.defiant || runtime.config.target?.activatingSkills),
            do: { type: 'necromancer.soul-shards', amount: 2 }
          }
        ],
        ticks: [{ atMs: 240, coefficient: 1.9 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // Capture shard eligibility at acceptance; target control and rewards remain impact-time queries.
    effectVariants: [
      {
        when: () => true,
        transform: (runtime, _cast, effects) => {
          const grant = (runtime as NecromancerRuntime).profession.core.soulShardGrant;
          const immobilize = grant.charges >= 3 && grant.expiresAt > runtime.time;
          return effects
            .filter((effect) => effect.packetLabel !== 'on-hit')
            .map((effect) =>
              effect.type === 'strike'
                ? { ...effect, metadata: { ...effect.metadata, necromancerAddleImmobilize: immobilize } }
                : effect
            );
        }
      }
    ]
  },
  [ID.ISOLATE]: {
    name: 'Isolate',
    description:
      'Throw a spear at your target. If it strikes a foe, it inflicts conditions and you may reactivate to teleport to that foe. \nThis skill recharges when exiting death shroud.',
    icon: 'https://render.guildwars2.com/file/CD722D70794A9A690DDBB4DF4638CC59CA06482E/3379164.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_4',
    cooldown: 18,
    flipDuration: 3,
    // Recharge tracks the same fraction of the accepted completion interval.
    rechargeProgress: 11 / 12,
    castTimeMs: 480,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2.4 },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 3 },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 8, duration: 8 }
    ]),
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.weapon-flip' } }]
  },
  [ID.DISTRESS]: {
    name: 'Distress',
    description:
      'Teleport to the foe marked by Isolate, recharge Perforate, and gain soul shards. Gain additional soul shards if there are no other enemies nearby.',
    icon: 'https://render.guildwars2.com/file/08B9D63645B11ACD3404B2F50539EDE8916CEE25/3379165.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_4',
    cooldown: 0,
    castTimeMs: 0,
    effects: [],
    // Completing Distress refreshes Perforate before its profession-owned shard grant.
    sideEffects: [
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.DISTRESS } },
      { on: 'castCommit', do: { type: 'rechargeReset', skillIds: [ID.PERFORATE] } },
      { on: 'castCommit', do: { type: 'necromancer.soul-shards', amount: 6 } }
    ]
  },
  [ID.EXTIRPATE]: {
    name: 'Extirpate',
    description:
      'Perform a wide swing that removes boons from foes. Gain soul shards and might for each target struck.',
    icon: 'https://render.guildwars2.com/file/7209CFEA65160A2F0154D015B12167744AD814FC/3379166.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_5',
    cooldown: 20,
    castTimeMs: 840,
    // Committed Extirpate preserves its impact effects without releasing the remaining cast lockout.
    interruptCommitMs: 800,
    retainsCastLockoutAfterInterrupt: true,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 760, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          // Only this selected application owns its accepted-impact reward.
          reactions: [
            {
              on: 'damage.resolved',
              actor: ACTOR.PLAYER,
              packets: 'first',
              when: (_runtime, { event }) => Number(event.coefficient) > 0,
              do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 12 } })
            },
            {
              on: 'damage.resolved',
              actor: ACTOR.PLAYER,
              packets: 'first',
              when: (_runtime, { event }) => Number(event.coefficient) > 0,
              do: { type: 'necromancer.soul-shards', amount: 2 }
            }
          ],
          coefficient: 3.8,
          comboFinishers: [
            {
              ownerId: 'necromancer',
              finisherType: COMBO_FINISHER.WHIRL,
              applications: 3
            }
          ]
        },
        { type: 'boon', boon: BOON.MIGHT, duration: 8, stacks: 5 },
        { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 3 },
        { type: 'buff', kind: 'extirpation', duration: 4, stacks: 3 }
      ]
    )
  }
});
