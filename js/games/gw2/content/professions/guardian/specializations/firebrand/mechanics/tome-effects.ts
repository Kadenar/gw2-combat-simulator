import { guardianTomeEventHandlers, reactToAshesHit } from '#gw2/content/professions/guardian/specializations/firebrand/mechanics/tomes.js';
import {
  handleFirebrandVirtueActivation,
  reactToFirebrandBuffTraits,
  reactToFirebrandJusticeHit
} from '#gw2/content/professions/guardian/specializations/firebrand/traits/index.js';

export const firebrandEventHandlers = Object.freeze({
  ...guardianTomeEventHandlers,
  'guardian.firebrand-virtue-activated': handleFirebrandVirtueActivation
});

export const firebrandEventReactions = Object.freeze({
  damage: Object.freeze([
    {
      // Ashes runs first (order 10) so it can consume a charge before Justice
      // (order 20) potentially changes the hit context for the same event.
      id: 'guardian.ashes-of-the-just',
      order: 10,
      handler: reactToAshesHit
    },
    {
      id: 'guardian.firebrand.justice',
      order: 20,
      handler: reactToFirebrandJusticeHit
    }
  ]),
  buff: Object.freeze([
    {
      id: 'guardian.firebrand.traits',
      order: 5,
      handler: reactToFirebrandBuffTraits
    }
  ])
});
