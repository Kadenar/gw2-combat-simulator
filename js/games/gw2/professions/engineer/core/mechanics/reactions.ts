import {
  handleConduitSurge,
  handleElectricArtillery,
  handleLightningRodPulse
} from '#gw2/professions/engineer/core/mechanics/event-handlers.js';
import { handleEngineerState } from '#gw2/professions/engineer/state.js';
import {
  engineerCoreCriticalHitDefinitions,
  handleEngineerDodge,
  reactToEngineerCondition,
  reactToEngineerDamage
} from '#gw2/professions/engineer/core/traits/index.js';

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
  'engineer.dodge': handleEngineerDodge,
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
