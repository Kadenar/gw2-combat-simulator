import { onAuraApplied } from '../../../../platform/gw2/native-profession.js';
import { reactToBerserkerAura } from './traits.js';

export const berserkerReactions = Object.freeze([
  onAuraApplied({
    id: 'warrior.berserker.fire-aura',
    handler: reactToBerserkerAura
  })
]);
