/** Compile declarative modifiers with explicit ordinary and final-condition attribute phases. */
import { applyAttributeContributions, applyFinalConditionAttributes } from '#gw2/platform/attributes/evaluation.js';
import { attributeSeed } from '#gw2/platform/attributes/inputs.js';
import { createModifierHooks, type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { ProfessionFamilyContract } from '#gw2/platform/profession-definition/family-contract.js';
import type {
  NormalizedProfessionContract,
  ProfessionConfig,
  ProfessionDefinition
} from '#gw2/platform/profession-definition/types.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import type { Skill } from '#gw2/platform/skills/types.js';

const MODIFIER_FIELDS: readonly string[] = ['modifierRules', 'damageBuckets'];

/** Reject unsupported declarations before normalization can silently discard their behavior. */
export function assertModifierDefinition(value: object, scope = 'modifiers'): void {
  for (const key of Object.keys(value)) {
    if (!MODIFIER_FIELDS.includes(key)) throw new TypeError(`Unsupported ${scope} field: ${key}.`);
  }
}

/**
 * Rejects malformed profession definitions before compilation begins.
 */
export function assertDefinition(definition: { readonly id: string; readonly name: string }): void {
  if (!/^[a-z][a-z0-9-]*$/.test(definition.id)) {
    throw new TypeError('Profession id must be a stable lowercase identifier.');
  }

  if (!definition.name.trim()) {
    throw new TypeError('Profession name is required.');
  }
}

type AttributePhases = Pick<NormalizedProfessionContract, 'modifyAttributes' | 'modifyConditionAttributes'>;

/**
 * Selects both attribute phases once. Without declarations, only compiled rules apply and final conditions are kept.
 * Combat queries supply one sample across phases; direct evaluator callers sample current facts themselves.
 */
function attributePhases(
  calculate: ProfessionDefinition['attributeContributions'],
  applyRules: AttributePhases['modifyAttributes']
): AttributePhases {
  if (!calculate)
    return { modifyAttributes: applyRules, modifyConditionAttributes: (_context, attributes) => attributes };

  const sampled = (context: Gw2ModifierContext) => context.attributeContributions ?? calculate(context);
  return {
    // Ordinary conversions and projections precede declarative attribute rules; Might is already in the input.
    modifyAttributes: (context, attributes) =>
      applyRules(
        context,
        applyAttributeContributions(
          attributeSeed(context.config ?? {}, context.runtime?.activeWeaponSet),
          attributes,
          sampled(context)
        )
      ),
    // The combat query calls this after equipment bonuses and actor projections have produced final Power.
    modifyConditionAttributes: (context, attributes) =>
      applyFinalConditionAttributes(context, attributes, sampled(context))
  };
}

/**
 * Creates immutable state and modifier capabilities with stable defaults.
 * Executable resource policies are validated separately with the runtime hooks.
 */
export function defineProfession<TProfessionState extends object, TSkill extends Skill = Skill>(
  definition: ProfessionDefinition<TProfessionState, TSkill>
): Readonly<NormalizedProfessionContract<TProfessionState, TSkill>> {
  assertDefinition(definition);
  const resources = definition.resources || {};
  const modifiers = definition.modifiers ?? {};
  assertModifierDefinition(modifiers);
  // Compile even empty declarations so equipment always participates exactly once in the damage bucket.
  const compiled = createModifierHooks({ rules: modifiers.modifierRules, damageBuckets: modifiers.damageBuckets });

  // Annotating the contract keeps the compiler checking every evaluator in this explicit list.
  const profession: NormalizedProfessionContract<TProfessionState, TSkill> = {
    attributeContributions: definition.attributeContributions,
    canSwapWeaponSetsInCombat: definition.canSwapWeaponSetsInCombat ?? true,
    id: definition.id,
    name: definition.name,
    weaponSkillMatchesSet: definition.weaponSkillMatchesSet,
    catalog: definition.catalog ?? createCanonicalCatalog<TSkill>(),
    // A stateless definition has no fields for its declared state type to require.
    createState: (config, balanceContext) =>
      resources.createState?.(config, balanceContext) ?? ({} as TProfessionState),
    // An absent projector delegates to the planning observer's detached state fallback.
    projectPlanningState: resources.projectPlanningState ?? (() => undefined),
    ...attributePhases(definition.attributeContributions, compiled.modifyAttributes),
    modifyCriticalChance: compiled.modifyCriticalChance,
    modifyCriticalDamage: compiled.modifyCriticalDamage,
    modifyConditionBaseDuration: compiled.modifyConditionBaseDuration,
    modifyConditionDuration: compiled.modifyConditionDuration,
    modifyStrikeDamage: compiled.modifyStrikeDamage,
    modifyConditionDamage: compiled.modifyConditionDamage
  };
  return Object.freeze(profession);
}

/** Selects the family's runtime for the supplied configuration; callers must supply a family contract. */
export function resolveProfessionContract<
  TProfessionState extends object = object,
  TRuntime extends NormalizedProfessionContract<TProfessionState> = NormalizedProfessionContract<TProfessionState>
>(
  profession: ProfessionFamilyContract<TProfessionState, TRuntime>,
  config: Readonly<ProfessionConfig> = {}
): Readonly<TRuntime> {
  return profession.resolveProfession(config);
}
