import {
  handleNecromancerStateEvent,
  handleNecromancerSummonAttack
} from '#gw2/professions/necromancer/core/mechanics/event-handlers.js';
import {
  reactToNecromancerBlind,
  reactToNecromancerCoreCondition,
  reactToNecromancerCoreControl,
  reactToNecromancerCoreDamage,
  reactToTasteForBloodAlliedHit,
  reactToTasteForBloodGrant,
  reactToVampiricPresenceAlliedHit
} from '#gw2/professions/necromancer/core/traits/index.js';
import { resolveTargetConditionCount } from '#gw2/professions/necromancer/core/mechanics/scheduler-feedback.js';

/**
 * Necromancer resolver-side handlers for profession state and summon events.
 */
export const necromancerCoreResolverEventHandlers = Object.freeze({
  'necromancer.target-condition-count': resolveTargetConditionCount,
  'necromancer.state': handleNecromancerStateEvent,
  'necromancer.summon-attack': handleNecromancerSummonAttack,
  'necromancer.taste-for-blood-grant': reactToTasteForBloodGrant,
  'necromancer.taste-for-blood-allied-hit': reactToTasteForBloodAlliedHit,
  'necromancer.vampiric-presence-allied-hit': reactToVampiricPresenceAlliedHit
});

/**
 * Ordered Core reaction descriptors consumed by the native module wiring.
 * Order zero preserves the previous Core-before-specialization dispatch order.
 */
export const necromancerCoreResolverEventReactions = Object.freeze({
  damage: Object.freeze([
    {
      id: 'necromancer.core.damage',
      order: 0,
      handler: reactToNecromancerCoreDamage
    }
  ]),
  condition: Object.freeze([
    {
      id: 'necromancer.core.condition',
      order: 0,
      handler: reactToNecromancerCoreCondition
    }
  ]),
  blind: Object.freeze([
    {
      id: 'necromancer.core.blind',
      order: 0,
      handler: reactToNecromancerBlind
    }
  ]),
  control: Object.freeze([
    {
      id: 'necromancer.core.control',
      order: 0,
      handler: reactToNecromancerCoreControl
    }
  ])
});
