import { righteousInstincts } from '#gw2/professions/guardian/core/traits/radiance.js';
import { onResolvedDamage, onConditionApplied, onBuffApplied } from '#gw2/platform/profession-definition/mechanics.js';
import { reactToCoreGuardianJusticeHit } from '#gw2/professions/guardian/core/mechanics/justice-reaction.js';
import { handleVirtueActivation, handleVirtueRefresh } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import {
  handleSymbolOfIgnitionField,
  reactToGuardianBuffTraits,
  reactToSymbolOfIgnition,
  reactToGuardianDamageTraits
} from '#gw2/professions/guardian/core/traits/index.js';

export const guardianCoreEventHandlers = Object.freeze({
  'guardian.virtue-activated': handleVirtueActivation,
  'guardian.virtues-refreshed': handleVirtueRefresh,
  ...righteousInstincts.eventHandlers,
  'guardian.symbol-of-ignition-field': handleSymbolOfIgnitionField
});

// Tag reactions here so module composition preserves their stage and registration order.
export const guardianCoreEventReactions = Object.freeze([
  onResolvedDamage({
    id: 'guardian.traits',
    order: 15,
    handler: reactToGuardianDamageTraits
  }),
  onResolvedDamage({
    id: 'guardian.justice',
    order: 20,
    handler: reactToCoreGuardianJusticeHit
  }),
  onConditionApplied({ id: 'guardian.ignition', order: 15, handler: reactToSymbolOfIgnition }),
  onBuffApplied({
    id: 'guardian.traits',
    order: 10,
    handler: reactToGuardianBuffTraits
  })
]);
