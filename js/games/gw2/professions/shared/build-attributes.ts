import type { ProfessionTraitSelection } from '#gw2/professions/shared/trait-data.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-presentation/balance-context.js';
import type { Gw2BuildAttributeRuleContext } from '#gw2/platform/builds/types.js';
import { finalizeBuildAttributes, resolveAttributeEffects } from '#gw2/platform/builds/attributes.js';

import type {
  Gw2AttributeEffect,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '#gw2/platform/builds/types.js';

import type { CanonicalCatalog, SkillId } from '#gw2/platform/engine/skills/types.js';

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
  readonly weapons: readonly string[];
  readonly profileContext: Pick<ProfessionBalanceContext, 'catalog'>;
  hasTrait(id: SkillId): boolean;
  hasSelectedSkill(id: SkillId): boolean;
}

// Catalog IDs may be authored as numbers or numeric strings; compare their canonical text form.
const sameId = (left: SkillId, right: SkillId): boolean => String(left) === String(right);

/**
 * Resolves active traits and exposes the common trait/skill lookup operations
 * used by profession build-attribute rules.
 *
 * disabledTrait is intentionally filtered here so every downstream lookup sees
 * the same effective trait set.
 */
export function createBuildAttributeContext<TTrait extends BuildAttributeTrait>(
  { build, selectedSkills, disabledTrait, weaponSet, balanceContext }: Gw2BuildAttributeRuleContext,
  catalog: CanonicalCatalog,
  getActiveTraits: (specializations: readonly ProfessionTraitSelection[]) => readonly TTrait[]
): BuildAttributeContext<TTrait> {
  const activeTraits = getActiveTraits((build.specializations || []) as ProfessionTraitSelection[]).filter(
    (trait) => trait.name !== disabledTrait
  );
  // Resolve patch data and weapon selection once for all profession attribute rules.
  const profileContext = balanceContext ?? { catalog };
  const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];

  // Rules identify traits and skills by stable catalog ID so renamed display names cannot silently disable them.
  function hasTrait(id: SkillId): boolean {
    return activeTraits.some((trait) => sameId(trait.id, id));
  }

  function hasSelectedSkill(id: SkillId): boolean {
    return selectedSkills.some((skill) => sameId(skill.id, id));
  }

  return {
    activeTraits,
    weapons,
    profileContext,
    hasTrait,
    hasSelectedSkill
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
