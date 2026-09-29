/**
 * Owns profession-wide Hammer variant selection and normalization.
 * Hammer skill fragments remain in `skills/weapons/hammer.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import type { Gw2WeaponMatcherContext } from '#gw2/platform/equipment/weapons/types.js';
import type { RangerConfig, RangerState } from '#gw2/professions/ranger/types.js';

export const RANGER_HAMMER_VARIANT_PAIRS: readonly (readonly [number, number])[] = Object.freeze([
  Object.freeze([ID.WILD_SWING, ID.UNLEASHED_WILD_SWING]) as readonly [number, number],
  Object.freeze([ID.OVERBEARING_SMASH, ID.UNLEASHED_OVERBEARING_SMASH]) as readonly [number, number],
  Object.freeze([ID.SAVAGE_SHOCK_WAVE, ID.UNLEASHED_SAVAGE_SHOCK_WAVE]) as readonly [number, number],
  Object.freeze([ID.THUMP, ID.UNLEASHED_THUMP]) as readonly [number, number]
]);

const DEFAULT_RANGER_HAMMER_SKILL_IDS: readonly number[] = Object.freeze(
  RANGER_HAMMER_VARIANT_PAIRS.map(([standard]) => standard)
);

const HAMMER_VARIANT_IDS = new Set<SkillId>(RANGER_HAMMER_VARIANT_PAIRS.flat());

/** Normalizes persisted Hammer choices to one valid skill from each slot pair. */
export function normalizeRangerHammerSkillIds(value: unknown): number[] {
  const source = Array.isArray(value) ? value.map(Number) : [];
  return RANGER_HAMMER_VARIANT_PAIRS.map((pair, index) =>
    pair.includes(source[index]) ? source[index] : DEFAULT_RANGER_HAMMER_SKILL_IDS[index]
  );
}

export function isRangerHammerVariant(skillId: SkillId): boolean {
  return HAMMER_VARIANT_IDS.has(skillId);
}

/** Untamed follows live unleash state; other rangers retain their per-slot build choices. */
export function rangerHammerSkillIds(context: Gw2WeaponMatcherContext & { readonly config?: RangerConfig }): number[] {
  if (rangerHammerUsesBuildSelection(context)) {
    return normalizeRangerHammerSkillIds(
      context.build?.selectedHammerSkillIds || context.config?.selectedHammerSkillIds
    );
  }

  const state = context.state as { readonly profession?: unknown } | undefined;
  const profession: Partial<RangerState> = flattenProfessionState(state?.profession || context.professionState);
  const rangerUnleashed =
    profession.rangerUnleashed ??
    (context.build?.initialUntamedState ?? context.config?.initialUntamedState) === 'Ranger';
  return RANGER_HAMMER_VARIANT_PAIRS.map((pair) => pair[rangerUnleashed ? 1 : 0]);
}

/** Only non-Untamed builds choose hammer variants independently of combat state. */
export function rangerHammerUsesBuildSelection(context: Gw2WeaponMatcherContext): boolean {
  return (context.specialization || context.config?.specialization) !== 'Untamed';
}
