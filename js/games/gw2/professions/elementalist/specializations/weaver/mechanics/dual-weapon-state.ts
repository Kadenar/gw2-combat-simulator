/**
 * Owns Weaver hand availability and dual-attunement metadata.
 * The cataloged weapon definitions live in
 * `skills/weapons/hammer.ts`.
 */
import { isElementalistAttunement, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Parses canonical skill metadata for a valid pair of distinct Weaver attunements. */
export function weaverDualAttunements(
  skill: ElementalistSkill
): readonly [ElementalistAttunement, ElementalistAttunement] | null {
  const parts = (skill.attunement || '').split('+');

  if (parts.length !== 2) return null;

  const [first, second] = parts;

  if (!isElementalistAttunement(first) || !isElementalistAttunement(second) || first === second) return null;

  return [first, second];
}

/** Slots 1 and 2 use the primary hand, slot 3 requires both elements, and slots 4 and 5 use the secondary. Unravel uses only the primary hand. */
export function weaverWeaponAttunementAvailable(
  skill: ElementalistSkill,
  primary: string,
  secondary: string,
  unravelActive: boolean
): boolean {
  const dual = weaverDualAttunements(skill);
  const required = dual || [String(skill.attunement)];
  const slot = Number(String(skill.slot || '').match(/(\d+)$/)?.[1] || 0);
  return unravelActive
    ? required.length === 1 && required[0] === primary
    : dual
      ? slot === 3 && required.every((element) => [primary, secondary].includes(element))
      : slot <= 2
        ? required[0] === primary
        : slot >= 4
          ? required[0] === secondary
          : primary === secondary && required[0] === primary;
}
