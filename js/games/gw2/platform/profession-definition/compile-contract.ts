import { compileGw2ModifierRules } from '#gw2/platform/combat/modifiers.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type { ProfessionFamilyContract } from '#gw2/platform/profession-definition/family-contract.js';
import type {
  NormalizedProfessionContract,
  ProfessionConfig,
  ProfessionDefinition
} from '#gw2/platform/profession-definition/types.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { DynamicFields } from '#kernel/core/dynamic-fields.js';
import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';

/**
 * Profession contract normalization. Validates sparse profession definitions
 * and composes deterministic no-op-safe hooks for the neutral engine.
 */

type ComposableHook = (...args: unknown[]) => unknown;

interface OrderedHook {
  readonly id: string;
  readonly order: number;
  readonly handler: ComposableHook;
  readonly index: number;
}

/** Only modifier transforms compose here; the selected modules already compose their planning projection. */
export const MODIFIER_HOOK_NAMES = Object.freeze([
  'modifyAttributes',
  'modifyConditionAttributes',
  'modifyCriticalChance',
  'modifyCriticalDamage',
  'modifyConditionBaseDuration',
  'modifyConditionDuration'
] as const);

const MODIFIER_FIELDS: readonly string[] = [...MODIFIER_HOOK_NAMES, 'modifierRules', 'damageBuckets'];

/** Reject unsupported declarations before normalization can silently discard their behavior. */
export function assertModifierDefinition(value: unknown, scope = 'modifiers'): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${scope} must be an object.`);
  }

  for (const key of Object.keys(value)) {
    if (!MODIFIER_FIELDS.includes(key)) throw new TypeError(`Unsupported ${scope} field: ${key}.`);
  }

  const rules = (value as UnvalidatedFields).modifierRules;

  if (rules != null && !Array.isArray(rules)) throw new TypeError(`${scope}.modifierRules must be an array.`);
}

const IDENTITY_SECOND_ARGUMENT: ComposableHook = (...args) => args[1];

/**
 * Normalizes one hook or hook list into an order-stable array.
 */
function orderedHooks(value: unknown, hookName: string): OrderedHook[] {
  const entries = value == null ? [] : Array.isArray(value) ? value : [value];
  const hooks = entries
    .map((entry, index) => {
      if (typeof entry === 'function') {
        return {
          id: `${hookName}:${index}`,
          order: 0,
          handler: entry as ComposableHook,
          index
        };
      }

      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new TypeError(`Invalid ${hookName} hook at index ${index}.`);
      }

      const candidate = entry as UnvalidatedFields;

      if (typeof candidate.handler !== 'function') {
        throw new TypeError(`Invalid ${hookName} hook at index ${index}.`);
      }

      return {
        id: String(candidate.id || `${hookName}:${index}`),
        order: Number(candidate.order || 0),
        handler: candidate.handler as ComposableHook,
        index
      };
    })
    .sort((left, right) => left.order - right.order || left.index - right.index || left.id.localeCompare(right.id));
  const ids = new Set<string>();
  for (const hook of hooks) {
    if (ids.has(hook.id)) {
      throw new TypeError(`Duplicate ${hookName} hook id: ${hook.id}.`);
    }

    ids.add(hook.id);
  }

  return hooks;
}

/** Chain modifier values in order, preserving the input when a contributor only observes it. */
function composeModifierHooks(value: unknown, hookName: string): ComposableHook {
  const hooks = orderedHooks(value, hookName);

  if (!hooks.length) return IDENTITY_SECOND_ARGUMENT;

  return (context: unknown, initialValue: unknown) =>
    hooks.reduce((value: unknown, hook) => {
      const next = hook.handler(context, value);
      return next === undefined ? value : next;
    }, initialValue);
}

/**
 * Rejects malformed profession definitions before hook composition begins.
 */
export function assertDefinition(definition: unknown): void {
  if (!definition || typeof definition !== 'object') {
    throw new TypeError('A profession definition must be an object.');
  }

  const candidate = definition as UnvalidatedFields;

  if (!/^[a-z][a-z0-9-]*$/.test(String(candidate.id || ''))) {
    throw new TypeError('Profession id must be a stable lowercase identifier.');
  }

  if (!String(candidate.name || '').trim()) {
    throw new TypeError('Profession name is required.');
  }

  // Equipment eligibility is a runtime policy shared with the application, independent of UI hooks.
  assertOptionalCallback(candidate, 'weaponSkillMatchesSet', 'profession');
  // Declaration sampling is a callable policy, shared by native and minimal query professions.
  assertOptionalCallback(candidate, 'attributeContributions', 'profession');
}

function assertOptionalCallback(container: object, name: string, scope: string): void {
  const candidate = container as UnvalidatedFields;

  if (candidate[name] != null && typeof candidate[name] !== 'function') {
    throw new TypeError(`${scope}.${name} must be a function.`);
  }
}

function assertCallbackContainer(container: object, names: readonly string[], scope: string): void {
  for (const name of names) assertOptionalCallback(container, name, scope);
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
  const compiled = compileGw2ModifierRules(modifiers.modifierRules ?? [], modifiers.damageBuckets);
  assertCallbackContainer(resources, ['createState', 'projectPlanningState'], 'resources');
  const composedHooks: DynamicFields = {};
  for (const name of MODIFIER_HOOK_NAMES) {
    const source = modifiers[name];
    const ruleHook = name === 'modifyConditionAttributes' ? undefined : compiled[name];
    const hooks = source == null ? [] : Array.isArray(source) ? source : [source];
    composedHooks[name] = composeModifierHooks(ruleHook ? [...hooks, ruleHook] : hooks, name);
  }

  if (definition.canSwapWeaponSetsInCombat != null && typeof definition.canSwapWeaponSetsInCombat !== 'boolean')
    throw new TypeError('canSwapWeaponSetsInCombat must be a boolean.');

  const profession = {
    attributeContributions: definition.attributeContributions,
    canSwapWeaponSetsInCombat: definition.canSwapWeaponSetsInCombat ?? true,
    id: definition.id,
    name: definition.name,
    weaponSkillMatchesSet: definition.weaponSkillMatchesSet,
    catalog: definition.catalog ?? createCanonicalCatalog<TSkill>(),
    createState: (config: Readonly<ProfessionConfig>, balanceContext?: ProfessionBalanceContext) =>
      resources.createState?.(config, balanceContext) ?? {},
    // An absent projector delegates to the planning observer's detached state fallback.
    projectPlanningState: resources.projectPlanningState ?? (() => undefined),
    ...composedHooks,
    modifyStrikeDamage: compiled.modifyStrikeDamage,
    modifyConditionDamage: compiled.modifyConditionDamage
  };
  return Object.freeze(profession) as unknown as Readonly<NormalizedProfessionContract<TProfessionState, TSkill>>;
}

/** Selects the family's runtime for the supplied configuration; callers must supply a family contract. */
export function resolveProfessionContract<
  TProfessionState extends object = object,
  TRuntime extends NormalizedProfessionContract<TProfessionState> = NormalizedProfessionContract<TProfessionState>
>(
  profession: ProfessionFamilyContract<TProfessionState, TRuntime>,
  config: Readonly<ProfessionConfig> = {}
): Readonly<TRuntime> {
  if (!profession || typeof profession !== 'object' || typeof profession.resolveProfession !== 'function') {
    throw new TypeError('A profession family contract is required.');
  }

  return profession.resolveProfession(config);
}
