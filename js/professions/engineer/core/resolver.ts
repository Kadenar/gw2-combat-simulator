import { handleConduitSurge, handleElectricArtillery, handleLightningRodPulse } from './events.js';
import { handleEngineerState } from '../state.js';
import { handleEngineerDodge, reactToEngineerCondition, reactToEngineerDamage } from './traits.js';

export {
  activeBoonStacks,
  applyEngineerDerivedCondition,
  procState,
  queueBuff,
  queueDamage,
  recordTrait,
  resolverSkill
} from './shared.js';

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
