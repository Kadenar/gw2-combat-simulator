import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { resourcePolicies, validateResourcePolicies } from '#gw2/platform/combat/resources/resource-policy.js';
/**
 * Profession contract normalization. Validates sparse profession definitions
 * and composes deterministic no-op-safe hooks for the neutral engine.
 */
import type { DynamicFields, UnvalidatedFields } from '#kernel/core/unvalidated.js';
import type { ProfessionConfig } from '#gw2/platform/execution/types.js';
import type { NormalizedProfessionContract, ProfessionDefinition } from '#gw2/platform/engine/profession/types.js';

type ComposableHook = (...args: any[]) => unknown;

interface OrderedHook {
  readonly id: string;
  readonly order: number;
  readonly handler: ComposableHook;
  readonly index: number;
}

type EventReaction<TContext, TEvent, TDetails, TResult> = (
  context: TContext,
  event: TEvent,
  details?: TDetails
) => TResult | undefined;
type HookCategory = 'modifier' | 'resource';

/**
 * Each hook belongs to one definition container; state projection belongs to
 * resources. Derive composition lists from this order so new hooks cannot
 * silently miss a subset list.
 */
const HOOK_DEFINITIONS = Object.freeze([
  ['projectPlanningState', 'resource'],
  ['modifyAttributes', 'modifier'],
  ['modifyCriticalChance', 'modifier'],
  ['modifyCriticalDamage', 'modifier'],
  ['modifyStrikeDamage', 'modifier'],
  ['modifyConditionDamage', 'modifier'],
  ['modifyConditionBaseDuration', 'modifier'],
  ['modifyConditionDuration', 'modifier']
] as const satisfies readonly (readonly [string, HookCategory])[]);

// Filtering by category preserves the corresponding container's finite set of hook names.
const hookNamesWith = <TCategory extends HookCategory>(category: TCategory) =>
  Object.freeze(HOOK_DEFINITIONS.filter(([, owner]) => owner === category).map(([name]) => name)) as readonly Extract<
    (typeof HOOK_DEFINITIONS)[number],
    readonly [string, TCategory]
  >[0][];

const HOOK_NAMES = Object.freeze(HOOK_DEFINITIONS.map(([name]) => name));
export const MODIFIER_HOOK_NAMES = hookNamesWith('modifier');

const NOOP: ComposableHook = (..._args) => undefined;
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

/**
 * Reduces normalized hooks into one callable function with semantics tailored
 * to the hook family: availability results fold, modifiers chain their return
 * values, and ordinary hooks simply run in order.
 */
function composeHooks(value: unknown, hookName: string, fallback: ComposableHook): ComposableHook {
  const hooks = orderedHooks(value, hookName);
  if (!hooks.length) return fallback;
  // Recharge commitment also chains Core and elite contributions, but is invoked only for accepted casts.
  // Preparers and modifiers preserve the current value when a hook returns undefined.
  if (hookName.startsWith('modify')) {
    const composed = (context: UnvalidatedFields, initialValue: unknown) =>
      hooks.reduce((chainedValue: unknown, hook) => {
        const next = hook.handler(context, chainedValue);
        return next === undefined ? chainedValue : next;
      }, initialValue);
    // Native damage rules consume explicit equipment inputs; ordinary profession hooks keep their numeric contract.
    if (hooks.some(({ handler }) => 'acceptsDamageInputs' in handler && handler.acceptsDamageInputs === true)) {
      return Object.assign(composed, { acceptsDamageInputs: true });
    }

    return composed;
  }

  return (context: UnvalidatedFields, value: unknown) => {
    let result: unknown;
    for (const hook of hooks) {
      const next = hook.handler(context, value);
      if (next !== undefined) result = next;
    }

    return result;
  };
}

/**
 * Normalizes resolver event reactions into deterministic per-event dispatchers.
 */
export function createEventReactions<
  TContext = UnvalidatedFields,
  TEvent = UnvalidatedFields,
  TDetails extends object = UnvalidatedFields,
  TResult = unknown
>(
  value: Readonly<Record<string, unknown>> | null | undefined
): Readonly<Record<string, EventReaction<TContext, TEvent, TDetails, TResult>>> {
  const reactions: Record<string, EventReaction<TContext, TEvent, TDetails, TResult>> = {};
  for (const [eventType, handlers] of Object.entries(value || {})) {
    const hooks = orderedHooks(handlers, `eventReactions.${eventType}`);
    reactions[eventType] = (context: TContext, event: TEvent, details = {} as TDetails) => {
      let result: TResult | undefined;
      for (const hook of hooks) {
        const next = hook.handler(context, event, details) as TResult | undefined;
        if (next !== undefined) result = next;
      }

      return result;
    };
  }

  return Object.freeze(reactions);
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
 * Creates an immutable profession contract with stable defaults for every
 * optional capability. The returned object is what the engine depends on; raw
 * profession definition objects are intentionally not used directly elsewhere.
 */

export function defineProfession<TProfessionState extends object, TBuild extends object = object>(
  definition: ProfessionDefinition<TProfessionState, TBuild>
): Readonly<NormalizedProfessionContract<TProfessionState>> {
  assertDefinition(definition);
  const resources = definition.resources || {};
  validateResourcePolicies(resources);
  // A selected resource capability must be complete; absence is the only unsupported-resource representation.
  if (
    resources.endurance &&
    ['state', 'maximum', 'regenerationRate'].some(
      (key) => typeof resources.endurance?.[key as keyof typeof resources.endurance] !== 'function'
    )
  ) {
    throw new TypeError('Endurance requires state, maximum, and regenerationRate callbacks.');
  }

  const modifiers = definition.modifiers || {};
  assertCallbackContainer(resources, ['createState', 'projectPlanningState'], 'resources');
  const sources: UnvalidatedFields = {
    projectPlanningState: resources.projectPlanningState,
    modifyAttributes: modifiers.modifyAttributes,
    modifyCriticalChance: modifiers.modifyCriticalChance,
    modifyCriticalDamage: modifiers.modifyCriticalDamage,
    modifyStrikeDamage: modifiers.modifyStrikeDamage,
    modifyConditionDamage: modifiers.modifyConditionDamage,
    modifyConditionBaseDuration: modifiers.modifyConditionBaseDuration,
    modifyConditionDuration: modifiers.modifyConditionDuration
  };

  const composedHooks: DynamicFields = {};
  for (const name of HOOK_NAMES) {
    const fallback = name.startsWith('modify') ? IDENTITY_SECOND_ARGUMENT : NOOP;
    composedHooks[name] = composeHooks(sources[name], name, fallback);
  }

  const profession = {
    id: definition.id,
    name: definition.name,
    weaponSkillMatchesSet: definition.weaponSkillMatchesSet,
    catalog: definition.catalog ?? createCanonicalCatalog(),
    createState: (config: Readonly<ProfessionConfig>) => resources.createState?.(config) ?? {},
    resources: Object.freeze({ ...resourcePolicies(resources), endurance: resources.endurance ?? null }),
    ...composedHooks,
    // Sparse standalone professions use the same runtime hooks as native family modules.
    runtimeFor() {
      return {
        ...profession,
        resources: resourcePolicies(resources),
        endurance: resources.endurance,
        ...definition.hooks
      };
    }
  };
  return Object.freeze(profession) as unknown as Readonly<NormalizedProfessionContract<TProfessionState>>;
}
