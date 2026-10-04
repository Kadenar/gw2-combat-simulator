import { finalizeBuildAttributes, resolveAttributeEffects } from '#gw2/platform/builds/attributes.js';
import type { Gw2BuildAttributeRuleContext } from '#gw2/platform/builds/types.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-presentation/balance-context.js';
import type { ProfessionTraitSelection } from '#gw2/professions/shared/trait-data.js';

import type {
  Gw2AttributeEffect,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '#gw2/platform/builds/types.js';

import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';

/**
 * Minimum trait shape required by the shared build-attribute helpers.
 *
 * Profession-specific trait types may contain any number of additional fields.
 */
export interface BuildAttributeTrait {
  readonly id: SkillId;
  readonly name: string;
}

/**
 * Common helpers used while evaluating profession build-attribute rules.
 */
export interface BuildAttributeContext<TTrait extends BuildAttributeTrait> {
  readonly activeTraits: readonly TTrait[];
  readonly profileContext: Pick<ProfessionBalanceContext, 'catalog'>;
  hasSelectedSkillId(id: SkillId): boolean;
}

/**
 * Resolves active traits and exposes the selected-skill lookup
 * used by profession build-attribute rules.
 *
 * disabledTrait is intentionally filtered here so every downstream lookup sees
 * the same effective trait set.
 */
export function createBuildAttributeContext<TTrait extends BuildAttributeTrait>(
  { build, selectedSkills, disabledTrait, balanceContext }: Gw2BuildAttributeRuleContext,
  catalog: CanonicalCatalog,
  getActiveTraits: (specializations: readonly ProfessionTraitSelection[]) => readonly TTrait[]
): BuildAttributeContext<TTrait> {
  const activeTraits = getActiveTraits((build.specializations || []) as ProfessionTraitSelection[]).filter(
    (trait) => trait.name !== disabledTrait
  );
  // Share the active patch context across profession attribute rules.
  const profileContext = balanceContext ?? { catalog };

  // Stable skill IDs keep renamed display names from disabling passives.
  function hasSelectedSkillId(id: SkillId): boolean {
    return selectedSkills.some((skill) => skill.id === id);
  }

  return {
    activeTraits,
    profileContext,
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
}

/**
 * Runs the common attribute-effect resolver and final GW2 attribute
 * finalization step.
 *
 * Profession files remain responsible for declaring their effects; this helper
 * only owns the repeated resolution/finalization pipeline.
 */
export function finalizeProfessionBuildAttributes<TTrait extends BuildAttributeTrait>(
  common: Gw2CommonAttributeResult,
  { activeTraits, attributeEffects = [] }: FinalizeProfessionBuildAttributesOptions<TTrait>,
  context: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  // Resolve all authored flats and conversions together so eligible inputs and rounding keep their existing phases.
  const contributions = context.traitBuildAttributes?.(common, context, activeTraits) ?? [];
  const traitStats = resolveAttributeEffects(common.commonContext.conversionPool, [
    ...attributeEffects,
    ...contributions.flatMap((entry) => entry.attributeEffects ?? [])
  ]);
  // Registered trait owners supply duration and critical-chance bonuses once.
  const durations: Gw2NumericAttributes = {};
  for (const contribution of contributions)
    for (const [name, amount] of Object.entries(contribution.traitDurations ?? {}))
      durations[name] = (durations[name] ?? 0) + amount;

  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations: durations,
    traitCriticalChance: contributions.reduce((sum, entry) => sum + (entry.traitCriticalChance ?? 0), 0)
  });
}
