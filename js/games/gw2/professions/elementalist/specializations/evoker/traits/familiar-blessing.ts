import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Element groups own named boon choices, independent of the selected profile's effect order or removals. */
const BLESSINGS: readonly { readonly elements: readonly ElementalistAttunement[]; readonly name: string }[] = [
  { elements: ['Fire', 'Air'], name: 'Quickness' },
  { elements: ['Water', 'Earth'], name: 'Alacrity' }
];

/** Completion selects its boon from the same element grouping displayed by trait tooltips. */
export function familiarBlessingName(element: ElementalistAttunement): string {
  return BLESSINGS.find(({ elements }) => elements.includes(element))!.name;
}

/** Expose only surviving named boons with the same element groups used by familiar completion. */
export function familiarBlessingEffects(context: unknown) {
  const profile = requireBalanceProfileFromContext(context, TRAIT.FAMILIARS_BLESSING);
  return BLESSINGS.flatMap(({ elements, name }) => {
    const effect = requireEffect(profile, 'boon', name);
    return effect ? [{ elements, effect }] : [];
  });
}
