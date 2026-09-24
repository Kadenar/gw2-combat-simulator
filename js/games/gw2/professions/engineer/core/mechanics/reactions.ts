import {
  onResolvedCriticalHit,
  onResolvedDamage,
  onConditionApplied
} from '#gw2/platform/profession-definition/mechanics.js';
import {
  handleAirBlast,
  handleConduitSurge,
  handleElectricArtillery,
  handleLightningRodPulse
} from '#gw2/professions/engineer/core/mechanics/event-handlers.js';
import { handleEngineerState } from '#gw2/professions/engineer/family-state.js';
import {
  engineerCoreCriticalHitDefinitions,
  reactToEngineerCondition,
  reactToEngineerDamage
} from '#gw2/professions/engineer/core/traits/index.js';
import { resetExplosiveEntrance } from '#gw2/professions/engineer/core/traits/explosives.js';

// event handlers fire when a specific event type is dequeued during resolution
export const engineerCoreResolverEventHandlers = Object.freeze({
  'engineer.air-blast': handleAirBlast,
  'engineer.state': handleEngineerState,
  // A resolved dodge rearms the trait for the next eligible strike.
  'engineer.dodge': resetExplosiveEntrance,
  'engineer.lightning-rod-pulse': handleLightningRodPulse,
  'engineer.conduit-surge': handleConduitSurge,
  'engineer.electric-artillery': handleElectricArtillery
});

// Tag reactions here so module composition preserves their stage and registration order.
export const engineerCoreResolverEventReactions = Object.freeze([
  ...engineerCoreCriticalHitDefinitions.map(onResolvedCriticalHit),
  onResolvedDamage({
    id: 'engineer.core.damage',
    order: 0,
    handler: reactToEngineerDamage
  }),
  onConditionApplied({
    id: 'engineer.core.condition',
    order: 0,
    handler: reactToEngineerCondition
  })
]);
