import {
  onResolvedDamage,
  onResolvedBlind,
  onResolvedControl,
  onConditionApplied
} from '#gw2/platform/profession-definition/mechanics.js';
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
import { reactToNecromancerAxeDamage } from '#gw2/professions/necromancer/core/mechanics/axe.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

/**
 * Necromancer resolver-side handlers for profession state and summon events.
 */
export const necromancerCoreResolverEventHandlers = Object.freeze({
  'necromancer.target-condition-count': resolveTargetConditionCount,
  'necromancer.state': handleNecromancerStateEvent,
  // Pool observations never replace shroud, trait, or summon state in the resolver.
  'necromancer.life-force': (context: NecromancerResolverContext, event: NecromancerResolverEvent) => {
    if (event.state?.lifeForce) professionCoreState(context).lifeForce = { ...event.state.lifeForce };
  },
  'necromancer.summon-attack': handleNecromancerSummonAttack,
  'necromancer.taste-for-blood-grant': reactToTasteForBloodGrant,
  'necromancer.taste-for-blood-allied-hit': reactToTasteForBloodAlliedHit,
  'necromancer.vampiric-presence-allied-hit': reactToVampiricPresenceAlliedHit
});

/**
 * Tag Core reactions here so modules consume their stages and registration order directly.
 * Order zero preserves the previous Core-before-specialization dispatch order.
 */
export const necromancerCoreResolverEventReactions = Object.freeze([
  // Skill-owned health and resource effects run on each resolved axe packet before trait reactions.
  onResolvedDamage({
    id: 'necromancer.core.axe-damage',
    order: -10,
    handler: reactToNecromancerAxeDamage
  }),
  onResolvedDamage({
    id: 'necromancer.core.damage',
    order: 0,
    handler: reactToNecromancerCoreDamage
  }),
  onResolvedBlind({
    id: 'necromancer.core.blind',
    order: 0,
    handler: reactToNecromancerBlind
  }),
  onResolvedControl({
    id: 'necromancer.core.control',
    order: 0,
    handler: reactToNecromancerCoreControl
  }),
  onConditionApplied({
    id: 'necromancer.core.condition',
    order: 0,
    handler: reactToNecromancerCoreCondition
  })
]);
