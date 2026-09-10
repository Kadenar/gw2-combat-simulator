import {
  handleConduitSurge,
  handleElectricArtillery,
  handleLightningRodPulse
} from '#gw2/professions/engineer/core/mechanics/event-handlers.js';
import { handleEngineerState } from '#gw2/professions/engineer/state.js';
import {
  engineerCoreCriticalHitDefinitions,
  reactToEngineerCondition,
  reactToEngineerDamage
} from '#gw2/professions/engineer/core/traits/index.js';
import { resetExplosiveEntrance } from '#gw2/professions/engineer/core/traits/explosives.js';

/** Re-exports Core resolver helpers used by Engineer traits and specialization reactions. */
export {
  activeBoonStacks,
  applyEngineerDerivedCondition,
  procState,
  queueBuff,
  queueDamage,
  recordTrait,
  resolverSkill
} from '#gw2/professions/engineer/core/mechanics/state-helpers.js';

// event handlers fire when a specific event type is dequeued during resolution
export const engineerCoreResolverEventHandlers = Object.freeze({
  'engineer.state': handleEngineerState,
  // A resolved dodge rearms the trait for the next eligible strike.
  'engineer.dodge': resetExplosiveEntrance,
  'engineer.lightning-rod-pulse': handleLightningRodPulse,
  'engineer.conduit-surge': handleConduitSurge,
  'engineer.electric-artillery': handleElectricArtillery
});

// reactions fire after every resolved damage or applied condition, regardless of event type
export const engineerCoreResolverEventReactions = Object.freeze({
  critical: engineerCoreCriticalHitDefinitions,
  damage: Object.freeze([
    {
      id: 'engineer.core.damage',
      order: 0,
      handler: reactToEngineerDamage
    }
  ]),
  condition: Object.freeze([
    {
      id: 'engineer.core.condition',
      order: 0,
      handler: reactToEngineerCondition
    }
  ])
});
