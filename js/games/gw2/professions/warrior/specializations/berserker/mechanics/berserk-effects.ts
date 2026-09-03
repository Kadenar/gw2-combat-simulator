import { onAuraApplied } from '#gw2/platform/profession-definition/mechanics.js';
import { reactToBerserkerAura } from '#gw2/professions/warrior/specializations/berserker/traits/index.js';

export const berserkerReactions = Object.freeze([
  onAuraApplied({
    id: 'warrior.berserker.fire-aura',
    handler: reactToBerserkerAura
  })
]);
