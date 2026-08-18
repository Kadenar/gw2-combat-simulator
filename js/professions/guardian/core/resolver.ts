import { handleVirtueActivation, handleVirtueRefresh, reactToJusticeHit } from './virtues.js';
import {
  handleSymbolOfIgnitionField,
  handleRighteousInstinctsTick,
  reactToGuardianBuffTraits,
  reactToGuardianDamageTraits
} from './traits.js';

export const guardianCoreEventHandlers = Object.freeze({
  'guardian.virtue-activated': handleVirtueActivation,
  'guardian.virtues-refreshed': handleVirtueRefresh,
  'guardian.righteous-instincts-tick': handleRighteousInstinctsTick,
  'guardian.symbol-of-ignition-field': handleSymbolOfIgnitionField
});

export const guardianCoreEventReactions = Object.freeze({
  damage: Object.freeze([
    {
      id: 'guardian.traits',
      order: 15,
      handler: reactToGuardianDamageTraits
    },
    {
      id: 'guardian.justice',
      order: 20,
      handler: reactToJusticeHit
    }
  ]),
  buff: Object.freeze([
    {
      id: 'guardian.traits',
      order: 10,
      handler: reactToGuardianBuffTraits
    }
  ])
});
