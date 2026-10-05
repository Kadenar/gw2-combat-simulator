import type { SlotSelectionPolicy } from '#gw2/platform/execution/availability.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_LOADOUT_SKILL_IDS } from '#gw2/professions/elementalist/data/skill-identities.js';

/** Authored identities link attunement variants without conflating unrelated same-name skills. */
export function elementalistLoadoutIdentity(id: SkillId): SkillId {
  return typeof id === 'number' ? (ELEMENTALIST_LOADOUT_SKILL_IDS.get(id) ?? id) : id;
}

/** An equipped slot selects its variants and explicitly authored next chain skill. */
export const elementalistSlotSelectionPolicy = {
  identity: elementalistLoadoutIdentity,
  allowsFollowUp: (skill, selected, catalog) =>
    [...selected].some((id) => catalog.skillsById.get(id)?.nextChainId === skill.id)
} satisfies SlotSelectionPolicy;
