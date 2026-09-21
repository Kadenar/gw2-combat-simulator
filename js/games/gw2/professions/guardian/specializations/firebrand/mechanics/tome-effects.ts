import { onResolvedDamage, onBuffApplied } from '#gw2/platform/profession-definition/mechanics.js';
import {
  guardianTomeEventHandlers,
  reactToAshesHit
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/tomes.js';
import {
  handleFirebrandVirtueActivation,
  reactToFirebrandBuffTraits,
  reactToFirebrandJusticeHit
} from '#gw2/professions/guardian/specializations/firebrand/traits/index.js';

export const firebrandEventHandlers = Object.freeze({
  ...guardianTomeEventHandlers,
  'guardian.firebrand-virtue-activated': handleFirebrandVirtueActivation
});

// Tag reactions here so module composition preserves their stage and registration order.
export const firebrandEventReactions = Object.freeze([
  onResolvedDamage({
    // Ashes runs first (order 10) so it can consume a charge before Justice
    // (order 20) potentially changes the hit context for the same event.
    id: 'guardian.ashes-of-the-just',
    order: 10,
    handler: reactToAshesHit
  }),
  onResolvedDamage({
    id: 'guardian.firebrand.justice',
    order: 20,
    handler: reactToFirebrandJusticeHit
  }),
  onBuffApplied({
    id: 'guardian.firebrand.traits',
    order: 5,
    handler: reactToFirebrandBuffTraits
  })
]);
