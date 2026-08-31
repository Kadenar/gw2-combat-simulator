import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillId } from '#gw2/platform/engine/types.js';

export const RANGER_HAMMER_VARIANT_PAIRS: readonly (readonly [number, number])[] = Object.freeze([
  Object.freeze([ID.WILD_SWING, ID.UNLEASHED_WILD_SWING]) as readonly [number, number],
  Object.freeze([ID.OVERBEARING_SMASH, ID.UNLEASHED_OVERBEARING_SMASH]) as readonly [number, number],
  Object.freeze([ID.SAVAGE_SHOCK_WAVE, ID.UNLEASHED_SAVAGE_SHOCK_WAVE]) as readonly [number, number],
  Object.freeze([ID.THUMP, ID.UNLEASHED_THUMP]) as readonly [number, number]
]);

export const DEFAULT_RANGER_HAMMER_SKILL_IDS: readonly number[] = Object.freeze(
  RANGER_HAMMER_VARIANT_PAIRS.map(([standard]) => standard)
);

const HAMMER_VARIANT_IDS = new Set<SkillId>(RANGER_HAMMER_VARIANT_PAIRS.flat());

export function normalizeRangerHammerSkillIds(value: unknown): number[] {
  const source = Array.isArray(value) ? value.map(Number) : [];
  return RANGER_HAMMER_VARIANT_PAIRS.map((pair, index) =>
    pair.includes(source[index]) ? source[index] : DEFAULT_RANGER_HAMMER_SKILL_IDS[index]
  );
}

export function isRangerHammerVariant(skillId: SkillId): boolean {
  return HAMMER_VARIANT_IDS.has(skillId);
}
