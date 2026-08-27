import { onAuraApplied } from '../../../../../integrations/patches/authoring/mechanics.js';
import { reactToBerserkerAura } from './traits.js';

export const berserkerReactions = Object.freeze([
  onAuraApplied({
    id: 'warrior.berserker.fire-aura',
    handler: reactToBerserkerAura
  })
]);
