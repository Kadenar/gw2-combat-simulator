import type { SlotSelectionPolicy } from '#gw2/platform/execution/availability.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';

/** Authored identities link attunement variants without conflating unrelated same-name skills. */
export function elementalistLoadoutIdentity(id: SkillId, catalog: Pick<CanonicalCatalog, 'skillsById'>): SkillId {
  return catalog.skillsById.get(id)?.loadoutSkillId ?? id;
}

/** An equipped slot selects its attunement variants; shared selection follows declared flip parents. */
export const elementalistSlotSelectionPolicy = {
  identity: elementalistLoadoutIdentity
} satisfies SlotSelectionPolicy;
