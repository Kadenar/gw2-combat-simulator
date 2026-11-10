/** Canonical Core necromancer skill definitions grouped by their GW2 owner. */
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetHealthBelow, vulnerabilityStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { ACTOR, CONDITION, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill, SkillDefinition } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

export const NECROMANCER_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.RENDING_CLAWS]: {
    name: 'Rending Claws',
    icon: 'https://render.guildwars2.com/file/9D1757C3D6ACA4727ECDE0049771C55FC250A81F/103811.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 720,
    // Each logged claw applies one Vulnerability stack at its own impact.
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Each landed claw reduces other axe recharges only while the target is below half health.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'each',
            when: (runtime, { event }) => Number(event.coefficient) > 0 && runtime.combat.targetHealthBelow(0.5),
            do: [{ type: 'necromancer.axe-recharge', amount: 0.5 }]
          }
        ],
        ticks: [400, 640].map((atMs) => ({ atMs, coefficient: 1.4 / 2 }))
      },
      {
        type: 'condition',
        ticks: [400, 640].map((atMs) => ({ atMs, condition: CONDITION.VULNERABILITY, duration: 7, stacks: 1 }))
      }
    ])
  },
  [ID.GHASTLY_CLAWS]: {
    name: 'Ghastly Claws',
    icon: 'https://render.guildwars2.com/file/96100F58946716DF6E23E975287AA9680BD144FA/103799.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_2',
    cooldown: 6,
    castTimeMs: 1520,
    interruptMode: 'per-packet',
    // Intrinsic Vulnerability scaling multiplies the ordinary target bonus.
    modifiers: [
      {
        // Ghastly Claws' own Vulnerability bonus multiplies the target's ordinary Vulnerability multiplier.
        id: 'necromancer.ghastly-claws-vulnerability',
        order: 108,
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        // The reference and runtime share this per-stack value, including selected balance edits.
        parameters: { damagePerStack: 0.01 },
        factor: (context, _target, parameters) => 1 + vulnerabilityStacks(context) * parameters.damagePerStack,
        when: (context) => context.event?.actorType === ACTOR.PLAYER
      },
      {
        // The execution bonus multiplies Vulnerability scaling and observes target health before each strike.
        id: 'necromancer.ghastly-claws-target-health',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        parameters: { healthThreshold: 0.5, damageIncrease: 0.2 },
        factor: (context, _target, parameters) =>
          context.event?.actorType === ACTOR.PLAYER && targetHealthBelow(context, parameters.healthThreshold)
            ? 1 + parameters.damageIncrease
            : 1
      }
    ],
    effects: [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'each',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: [lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 12 / 8 } })]
          }
        ],
        // The supplied Quickness logs resolve eight individual hits; interruptions preserve only reached packets.
        ticks: [320, 440, 600, 760, 920, 1040, 1200, 1360].map((atMs) => ({ atMs, coefficient: 4.6 / 8 })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.UNHOLY_FEAST]: {
    name: 'Unholy Feast',
    icon: 'https://render.guildwars2.com/file/2A1707BB93BBF8B1A414D37BBFC5CAC90105D5DF/103567.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_3',
    cooldown: 10,
    // The impact precedes cast completion; its health-gated burst is scheduled from that impact.
    castTimeMs: 920,
    interruptCommitMs: 720,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // The selected landed strike owns this skill-specific transaction.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'each',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: [{ type: 'necromancer.axe-health' }]
          }
        ],
        coefficient: 2.5,
        hits: 1
      },
      { type: 'condition', condition: CONDITION.CRIPPLED, duration: 5, stacks: 1 }
    ])
  }
};

// The log's separate burst identity is a triggered strike, with a fixed delay after Feast's qualifying impact.
export const NECROMANCER_AXE_EXTRA_SKILLS: readonly Skill[] = [
  {
    name: 'Unholy Burst',
    icon: 'https://render.guildwars2.com/file/2A1707BB93BBF8B1A414D37BBFC5CAC90105D5DF/103567.png',
    id: ID.UNHOLY_BURST,
    type: 'Proc',
    rotationInputExcluded: true,
    parentId: ID.UNHOLY_FEAST,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        weapon: WEAPON.AXE
      }
    ]
  }
];
