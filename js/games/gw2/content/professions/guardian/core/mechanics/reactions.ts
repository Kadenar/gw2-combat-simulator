import { reactToCoreGuardianJusticeHit } from '#gw2/content/professions/guardian/core/mechanics/justice-reaction.js';
import {
  handleVirtueActivation,
  handleVirtueRefresh
} from '#gw2/content/professions/guardian/core/mechanics/virtues.js';
import {
  handleSymbolOfIgnitionField,
  handleRighteousInstinctsTick,
  reactToGuardianBuffTraits,
  reactToGuardianDamageTraits
} from '#gw2/content/professions/guardian/core/traits/index.js';

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
      handler: reactToCoreGuardianJusticeHit
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
