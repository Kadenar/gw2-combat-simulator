import { attributeSeedFromCommon } from '#gw2/platform/builds/attribute-inputs.js';
import { attributeContext, resolveAttributeContributions } from '#gw2/platform/builds/attribute-evaluation.js';
import { finalizeBuildAttributes } from '#gw2/platform/builds/attributes.js';
import type { Gw2BuildAttributeRuleContext } from '#gw2/platform/builds/types.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type { ProfessionTraitSelection } from '#gw2/professions/shared/trait-data.js';

import type { Gw2CommonAttributeResult, Gw2FinalizedAttributeResult } from '#gw2/platform/builds/types.js';

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
 * Effective trait selection and tuning used by the shared build evaluator.
 */
export interface BuildAttributeContext<TTrait extends BuildAttributeTrait> {
  readonly activeTraits: readonly TTrait[];
  readonly profileContext: ProfessionBalanceContext;
}

/**
 * Resolves active traits and the balance context for profession build attributes.
 *
 * disabledTrait is intentionally filtered here so every downstream lookup sees
 * the same effective trait set.
 */
export function createBuildAttributeContext<TTrait extends BuildAttributeTrait>(
  { build, disabledTrait, balanceContext }: Gw2BuildAttributeRuleContext,
  catalog: CanonicalCatalog,
  getActiveTraits: (specializations: readonly ProfessionTraitSelection[]) => readonly TTrait[]
): BuildAttributeContext<TTrait> {
  const activeTraits = getActiveTraits((build.specializations || []) as ProfessionTraitSelection[]).filter(
    (trait) => trait.name !== disabledTrait
  );
  // Share the active patch context across profession attribute rules.
  const profileContext = balanceContext ?? { catalog, modifierRulesById: new Map() };

  return {
    activeTraits,
    profileContext
  };
}

/**
 * Selection and tuning supplied by a profession's build adapter.
 */
export interface FinalizeProfessionBuildAttributesOptions<TTrait> {
  readonly activeTraits: readonly TTrait[];
  readonly profileContext: ProfessionBalanceContext;
}

/**
 * Resolves native module and trait contributions through the shared evaluator,
 * then finalizes the build's GW2 attributes without a separate build-only effect channel.
 */
export function finalizeProfessionBuildAttributes<TTrait extends BuildAttributeTrait>(
  common: Gw2CommonAttributeResult,
  { activeTraits, profileContext }: FinalizeProfessionBuildAttributesOptions<TTrait>,
  context: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  // The panel supplies explicit preview facts to the same selected-owner evaluator used by live queries.
  const build = context.build;
  // Each panel calculation has one active equipment set; named sources must read that exact unprocessed seed.
  const seed = attributeSeedFromCommon(common);
  const config = {
    ...build,
    attributeInputs: { weaponSets: [seed, seed] as const },
    specialization: (build.specializations?.at(-1) as { name?: string } | undefined)?.name ?? 'Core',
    selectedTraitIds: activeTraits.map((trait) => trait.id),
    selectedSkillIds: context.selectedSkills.map((skill) => skill.id),
    boons: build.assumptions as Readonly<Record<string, number | boolean>>,
    startingWeaponSet: context.weaponSet,
    primaryWeapon: build.weapons?.[0],
    secondaryWeapon: build.weapons?.[1],
    weaponSet2Primary: build.alternateWeapons?.[0],
    weaponSet2Secondary: build.alternateWeapons?.[1]
  };
  const balanceContext = profileContext;
  const facts = attributeContext({ config, time: 0 }, balanceContext, {
    weapons: build.weapons ?? [],
    alternateWeapons: build.alternateWeapons ?? [],
    assumptions: build.assumptions ?? {},
    selectedLegends: (build as { selectedLegends?: string[] }).selectedLegends ?? [],
    merged: build.specializations?.some((s) => (s as { name?: string }).name === 'Soulbeast') ?? false
  });
  const contributions = context.attributeContributions?.(facts) ?? [];
  const resolved = resolveAttributeContributions(common.commonContext.conversionPool, contributions);
  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats: resolved.attributes,
    traitDurations: resolved.durations,
    // Reuse the evaluator's aggregate so build finalization shares its contribution semantics.
    traitCriticalChance: resolved.criticalChance
  });
}
