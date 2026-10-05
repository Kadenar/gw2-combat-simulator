import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const NECROMANCER_WEAPONS_DAGGER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.DARK_PACT]: {
    castTimeMs: 680,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // The selected landed strike owns this skill-specific transaction.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: { type: 'necromancer.dark-pact' }
          }
        ],
        coefficient: 2.4
      },
      { type: 'condition', condition: 'Bleeding', stacks: 2, duration: 10 }
    ])
  },
  [ID.NECROTIC_SLASH]: {
    castTimeMs: 360,
    // The slash lands before its aftercast; committed interruptions keep its strike packet.
    interruptCommitMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 2,
        atMs: 0,
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.NECROTIC_STAB]: {
    castTimeMs: 400,
    effects: [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 4 } })
          }
        ],
        ticks: [{ atMs: 160, coefficient: 0.9 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.NECROTIC_BITE]: {
    castTimeMs: 640,
    effects: [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 8 } })
          }
        ],
        coefficient: 1.3,
        hits: 1
      }
    ]
  },
  [ID.DEATHLY_SWARM]: {
    castTimeMs: 480,
    // The handler and tooltip share the maximum number of distinct self-condition types transferred.
    conditionsTransferred: 2,
    effects: [
      {
        type: 'strike',
        // The selected landed strike owns this skill-specific transaction.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: { type: 'necromancer.transfer' }
          }
        ],
        coefficient: 1.2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Blindness',
        stacks: 1,
        duration: 6
      }
    ]
  },
  [ID.ENFEEBLING_BLOOD]: {
    castTimeMs: 840,
    // The ground packet commits before its delayed impact; cancelling retains the full cast lockout.
    interruptCommitMs: 520,
    retainsCastLockoutAfterInterrupt: true,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 1200, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 1.5 },
        { type: 'condition', condition: 'Bleeding', stacks: 3, duration: 10 },
        { type: 'condition', condition: 'Weakness', stacks: 1, duration: 6 }
      ]
    )
  },
  [ID.LIFE_SIPHON]: {
    castTimeMs: 560,
    effects: [
      {
        type: 'strike',
        // The selected landed strike owns this skill-specific transaction.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: { type: 'necromancer.life-siphon' }
          }
        ],
        ticks: Array.from({ length: 9 }, (_, index) => ({ atMs: 480 + index * 160, coefficient: 2.7 / 9 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});

/** Intrinsic impact-time formula; the existing modifier registry preserves its operation and ordering. */
export const lifeSiphonBleedingModifier: Gw2ModifierRule = {
  id: 'necromancer.life-siphon-bleeding-target',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  factor: 1.5,
  order: 100,
  when: (context) =>
    skillForEvent(context.profession?.catalog, context.event, context.skillId)?.id === ID.LIFE_SIPHON &&
    targetConditionActive(context, 'Bleeding')
};
