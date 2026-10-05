import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { eventSkill } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
/**
 * Owns Reaper shout skill fragments.
 * Reaper Shroud skill fragments live in `shroud-skills.ts`.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Supplies Reaper shout fragments to specialization composition. */
export const REAPER_SHOUT_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.YOU_ARE_ALL_WEAKLINGS]: {
    castTimeMs: 0,
    effects: [
      { type: 'strike', coefficient: 2.5, hits: 1 },
      { type: 'control', controlKind: 'control' }
    ]
  },
  [ID.NOTHING_CAN_SAVE_YOU]: {
    castTimeMs: 360,
    effects: [
      { type: 'strike', coefficient: 2, hits: 1 },
      { type: 'condition', condition: 'Vulnerability', duration: 10, stacks: 6 }
    ]
  },
  [ID.CHILLED_TO_THE_BONE]: {
    castTimeMs: 680,
    effects: [
      { type: 'strike', coefficient: 3, hits: 1 },
      { type: 'control', controlKind: 'control' },
      { type: 'condition', condition: 'Chilled', stacks: 1, duration: 4 }
    ]
  },
  [ID.YOUR_SOUL_IS_MINE]: {
    castTimeMs: 680,
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
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 15 } })
          }
        ],
        coefficient: 0.5,
        hits: 1
      }
    ]
  },
  [ID.SUFFER]: {
    castTimeMs: 0,
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
        coefficient: 1.5,
        hits: 1
      },
      { type: 'condition', condition: 'Chilled', stacks: 1, duration: 3 }
    ]
  },
  [ID.RISE]: {
    castTimeMs: 360,
    effects: [{ type: 'strike', coefficient: 0.8, hits: 1 }]
  }
});

/** Intrinsic impact-time formula; the existing modifier registry preserves its operation and ordering. */
export const reaperShoutMeleeModifier: Gw2ModifierRule = {
  // The simulator's target is always nearby, so player shout packets always receive the melee bonus.
  id: 'necromancer.reaper-shout-melee',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  factor: 2,
  // order: 100 places this after additive damage buckets so it multiplies the already-summed base.
  order: 100,
  when: (context) =>
    Boolean(
      // Shout doubling belongs to the player's skill packet, not merely an effect that inherits player modifiers.
      isGw2PlayerActorEvent(context.event) && eventSkill(context)?.categories?.includes('Shout')
    )
};
