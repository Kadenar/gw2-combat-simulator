import { onAuraApplied } from '#gw2/integrations/patches/authoring/mechanics.js';
import { reactToBerserkerAura } from '#gw2/content/professions/warrior/specializations/berserker/traits/index.js';

export const berserkerReactions = Object.freeze([
  onAuraApplied({
    id: 'warrior.berserker.fire-aura',
    handler: reactToBerserkerAura
  })
]);
