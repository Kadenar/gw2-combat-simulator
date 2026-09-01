import { guardianRadiantForgeEventHandlers } from '#gw2/content/professions/guardian/specializations/luminary/mechanics/radiant-forge.js';
import { reactToLuminaryJusticeHit } from '#gw2/content/professions/guardian/specializations/luminary/traits/index.js';
import {
  handleEffulgentActivated,
  handleEffulgentDetonate,
  reactToEffulgentStrike
} from '#gw2/content/professions/guardian/specializations/luminary/mechanics/stances.js';
import {
  handleLightAuraDetonate,
  handleLightAuraGrant,
  handleLightFieldStart,
  handleLightFinisher
} from '#gw2/content/professions/guardian/specializations/luminary/mechanics/light-fields.js';

export const luminaryEventHandlers = Object.freeze({
  ...guardianRadiantForgeEventHandlers,
  // These two handlers run inside the resolver (not the scheduler) because
  // effulgent stack counting happens on already-resolved damage packets.
  'guardian.effulgent-activated': handleEffulgentActivated,
  'guardian.effulgent-detonate': handleEffulgentDetonate,
  'guardian.luminary.light-aura-detonate': handleLightAuraDetonate,
  'guardian.luminary.light-aura-grant': handleLightAuraGrant,
  'guardian.luminary.light-field-start': handleLightFieldStart,
  'guardian.luminary.light-finisher': handleLightFinisher
});

export const luminaryEventReactions = Object.freeze({
  damage: Object.freeze([
    {
      // order 16 intentionally runs before justice (20) so stack count is
      // up-to-date if a justice proc fires on the same damage packet.
      id: 'guardian.luminary.effulgent',
      order: 16,
      handler: reactToEffulgentStrike
    },
    {
      id: 'guardian.luminary.justice',
      order: 20,
      handler: reactToLuminaryJusticeHit
    }
  ])
});
