import { finalizeBuildAttributes, resolveAttributeEffects } from '#gw2/platform/builds/attributes.js';

import type {
  Gw2AttributeEffect,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '#gw2/platform/builds/types.js';

import type { Skill, SkillId } from '#gw2/platform/engine/types.js';

/**
 * Minimum trait shape required by the shared build-attribute helpers.
 *
 * Profession-specific trait types may contain any number of additional fields.
 */
export interface BuildAttributeTrait {
  readonly name: string;
}

/**
 * Options used to construct the common context needed by profession
 * build-attribute rules.
 */
export interface CreateBuildAttributeContextOptions<TTrait extends BuildAttributeTrait, TSelection> {
  readonly specializations?: readonly TSelection[] | null;
  readonly selectedSkills?: readonly Skill[] | null;
  readonly disabledTrait?: string | null;

  readonly getActiveTraits: (specializations: readonly TSelection[]) => readonly TTrait[];
}

/**
 * Common helpers used while evaluating profession build-attribute rules.
 */
export interface BuildAttributeContext<TTrait extends BuildAttributeTrait> {
  readonly activeTraits: readonly TTrait[];
  readonly selectedSkills: readonly Skill[];
  hasTrait(name: string): boolean;
  hasSelectedSkill(name: string): boolean;
  hasSelectedSkillId(id: SkillId): boolean;
}

/**
 * Resolves active traits and exposes the common trait/skill lookup operations
 * used by profession build-attribute rules.
 *
 * disabledTrait is intentionally filtered here so every downstream lookup sees
 * the same effective trait set.
 */
export function createBuildAttributeContext<TTrait extends BuildAttributeTrait, TSelection>({
  specializations = [],
  selectedSkills = [],
  disabledTrait = null,
  getActiveTraits
}: CreateBuildAttributeContextOptions<TTrait, TSelection>): BuildAttributeContext<TTrait> {
  const activeTraits = getActiveTraits(specializations || []).filter((trait) => trait.name !== disabledTrait);

  const effectiveSelectedSkills = selectedSkills || [];

  function hasTrait(name: string): boolean {
    return activeTraits.some((trait) => trait.name === name);
  }

  function hasSelectedSkill(name: string): boolean {
    return effectiveSelectedSkills.some((skill) => skill.name === name);
  }

  function hasSelectedSkillId(id: SkillId): boolean {
    return effectiveSelectedSkills.some((skill) => skill.id === id);
  }

  return {
    activeTraits,
    selectedSkills: effectiveSelectedSkills,
    hasTrait,
    hasSelectedSkill,
    hasSelectedSkillId
  };
}

/**
 * Values supplied by an individual profession after it has declared its
 * profession-specific attribute effects.
 */
export interface FinalizeProfessionBuildAttributesOptions<TTrait> {
  readonly activeTraits: readonly TTrait[];
  readonly attributeEffects?: readonly Gw2AttributeEffect[];
  readonly traitDurations?: Readonly<Gw2NumericAttributes>;
  readonly traitCriticalChance?: number;
}

/**
 * Runs the common attribute-effect resolver and final GW2 attribute
 * finalization step.
 *
 * Profession files remain responsible for declaring their effects; this helper
 * only owns the repeated resolution/finalization pipeline.
 */
export function finalizeProfessionBuildAttributes<TTrait>(
  common: Gw2CommonAttributeResult,
  {
    activeTraits,
    attributeEffects = [],
    traitDurations = {},
    traitCriticalChance
  }: FinalizeProfessionBuildAttributesOptions<TTrait>
): Gw2FinalizedAttributeResult {
  const traitStats = resolveAttributeEffects(common.commonContext.conversionPool, attributeEffects);

  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations,
    ...(traitCriticalChance == null ? {} : { traitCriticalChance })
  });
}
