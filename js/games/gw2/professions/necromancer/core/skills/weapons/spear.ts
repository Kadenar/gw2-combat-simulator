/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

export const NECROMANCER_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.DARK_SLASH]: {
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
