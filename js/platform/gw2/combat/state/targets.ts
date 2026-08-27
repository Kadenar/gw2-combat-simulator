/** Normalizes configured and runtime target conditions behind canonical stack queries. */
import type { Gw2Config } from '../../simulation/config.js';
import type { Gw2RuntimeConditionStack, Gw2RuntimeStateLike } from './types.js';

const CONDITION_ALIASES = Object.freeze({
  bleed: 'Bleeding',
  bleeding: 'Bleeding',
  blind: 'Blinded',
  blinded: 'Blinded',
  burn: 'Burning',
  burning: 'Burning',
  chill: 'Chilled',
  chilled: 'Chilled',
  confusion: 'Confusion',
  cripple: 'Crippled',
  crippled: 'Crippled',
  fear: 'Fear',
  feared: 'Fear',
  immobilize: 'Immobilized',
  immobilized: 'Immobilized',
  poison: 'Poisoned',
  poisoned: 'Poisoned',
  slow: 'Slow',
  slowed: 'Slow',
  taunt: 'Taunt',
  taunted: 'Taunt',
  torment: 'Torment',
  vulnerability: 'Vulnerability',
  weakness: 'Weakness',
  weakened: 'Weakness'
});

// The canonical damaging subset uses runtime condition names so resolution and
// profession rules cannot disagree about aliases such as Poison and Poisoned.
export const GW2_DAMAGING_CONDITIONS = Object.freeze([
  'Bleeding',
  'Burning',
  'Confusion',
  'Poisoned',
  'Torment'
] as const);
const DAMAGING_CONDITION_SET = new Set<string>(GW2_DAMAGING_CONDITIONS);

const CANONICAL_CONDITION_STATE_MAPS = new WeakSet<ReadonlyMap<string, unknown>>();

export const CANONICAL_TARGET_CONDITIONS = Object.freeze([...new Set(Object.values(CONDITION_ALIASES))].sort());

/** Creates an internally owned condition map whose keys are canonicalized before insertion. */
export function createCanonicalTargetConditionStateMap<T>(): Map<string, T> {
  const state = new Map<string, T>();
  CANONICAL_CONDITION_STATE_MAPS.add(state);
  return state;
}

/**
 * Normalizes simulator and wiki condition spellings to the canonical runtime
 * vocabulary. Unknown values retain a stable title-cased form so supplemental
 * profession data remains queryable without inventing per-condition flags.
 */
export function canonicalTargetConditionName(value: unknown): string {
  const text = String(value || '').trim();

  if (!text) return '';
  const normalized = text.toLowerCase();
  return (
    (CONDITION_ALIASES as Readonly<Record<string, string>>)[normalized] ||
    normalized.charAt(0).toUpperCase() + normalized.slice(1)
  );
}

/** Checks damaging-condition membership after applying the shared alias normalization contract. */
export function isDamagingCondition(value: unknown): boolean {
  return DAMAGING_CONDITION_SET.has(canonicalTargetConditionName(value));
}

function normalizeTargetConditions(
  conditions: Readonly<Record<string, number | boolean>>
): ReadonlyMap<string, number | boolean> {
  const normalized = new Map<string, number | boolean>();
  for (const [condition, value] of Object.entries(conditions)) {
    const name = canonicalTargetConditionName(condition);

    if (!normalized.has(name)) normalized.set(name, value);
  }

  return normalized;
}

/**
 * Resolves a configured target condition with canonical and alias-aware matching.
 * @param {Gw2Config} config - Simulation config containing target state
 * @param {string} name - Condition name (e.g., "Vulnerability", "Slow")
 * @returns {number|boolean} Configured value or 0 if not found
 * @private
 */
function configuredConditionValue(
  config: Gw2Config,
  name: string,
  normalizedConditions: ReadonlyMap<string, number | boolean> | null = null
): number | boolean {
  const canonicalName = canonicalTargetConditionName(name);
  const conditions = config.target?.conditions || {};

  if (Object.hasOwn(conditions, canonicalName)) {
    return conditions[canonicalName];
  }

  if (normalizedConditions) {
    return normalizedConditions.get(canonicalName) ?? 0;
  }

  const entry = Object.entries(conditions).find(
    ([condition]) => canonicalTargetConditionName(condition) === canonicalName
  );

  if (entry) return entry[1];

  return 0;
}

/** Creates a normalized lookup for permanent target-condition stacks. */
export function createPermanentTargetConditionStacks(config: Gw2Config): (name: string) => number {
  const normalizedConditions = normalizeTargetConditions(config.target?.conditions || {});
  return (name: string): number => {
    const value = configuredConditionValue(config, name, normalizedConditions);

    if (value === true) return 1;
    return Math.max(0, Number(value) || 0);
  };
}

/**
 * Gets stack count of permanent condition on target.
 * Boolean true converts to 1 stack; numeric values preserved; falsy returns 0.
 * @param {Gw2Config} config - Simulation config
 * @param {string} name - Condition name to check
 * @returns {number} Stack count (≥0)
 * @example
 * permanentTargetConditionStacks(config, "Vulnerability") // → 2
 */
export function permanentTargetConditionStacks(config: Gw2Config, name: string): number {
  const value = configuredConditionValue(config, name);

  if (value === true) return 1;
  return Math.max(0, Number(value) || 0);
}

/**
 * Checks whether target has active permanent condition.
 * @param {Gw2Config} config - Simulation config
 * @param {string} name - Condition name to check
 * @returns {boolean} True if condition stacks > 0
 * @example
 * targetHasPermanentCondition(config, "Vulnerability") // → true
 */
export function targetHasPermanentCondition(config: Gw2Config, name: string): boolean {
  return permanentTargetConditionStacks(config, name) > 0;
}

/**
 * @param {Gw2RuntimeConditionStack} stack
 * @param {number} at
 */
function activeRuntimeStackWeight(stack: Gw2RuntimeConditionStack, at: number): number {
  const appliedAt = Number(stack?.appliedAt ?? -Infinity);
  const expiresAt = Number(stack?.expiresAt ?? Infinity);
  const removedAt = Number(stack?.removedAt ?? Infinity);
  return appliedAt <= at && expiresAt > at && removedAt > at
    ? Math.max(0, Number(stack?.weight ?? stack?.stacks ?? 0))
    : 0;
}

/**
 * Gets the active player-applied stacks recorded by scheduler or resolver
 * runtime state. Half-open expiry/removal boundaries preserve chronological
 * same-time behavior: a stack is visible only after its application has been
 * inserted into runtime state and is inactive at its expiry/removal timestamp.
 */
export function runtimeTargetConditionStacks(
  runtime: Gw2RuntimeStateLike | null | undefined,
  name: string,
  at: number
): number {
  if (!(runtime?.conditionState instanceof Map)) return 0;
  const canonicalName = canonicalTargetConditionName(name);

  if (CANONICAL_CONDITION_STATE_MAPS.has(runtime.conditionState)) {
    const entry = runtime.conditionState.get(canonicalName);
    return (entry?.stacks || []).reduce((sum, stack) => sum + activeRuntimeStackWeight(stack, at), 0);
  }

  // Externally supplied and legacy maps may contain aliases or duplicate
  // spellings, so retain the complete compatibility scan for unmarked maps.
  let total = 0;
  for (const [condition, entry] of runtime.conditionState) {
    if (canonicalTargetConditionName(condition) !== canonicalName) continue;
    total += (entry?.stacks || []).reduce((sum, stack) => sum + activeRuntimeStackWeight(stack, at), 0);
  }

  return total;
}

/**
 * Gets target-condition stacks from permanent scenario assumptions plus
 * chronological runtime applications.
 */
export function targetConditionStacks(
  config: Gw2Config,
  name: string,
  at: number,
  runtime: Gw2RuntimeStateLike | null = null
): number {
  return permanentTargetConditionStacks(config, name) + runtimeTargetConditionStacks(runtime, name, Number(at || 0));
}

/** Reports whether permanent assumptions or runtime state give the target a condition. */
export function targetHasCondition(
  config: Gw2Config,
  name: string,
  at: number,
  runtime: Gw2RuntimeStateLike | null = null
): boolean {
  return targetConditionStacks(config, name, at, runtime) > 0;
}
