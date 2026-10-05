/** Targets never carry boons; configured conditions and runtime condition stacks remain queryable. */
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { isTimeInWindow } from '#kernel/core/clock.js';

const HOSTILE_TARGET_EVENT_TYPES = new Set(['damage', 'condition', 'condition_tick', 'control']);

/** Accepted player/summon target actions establish combat before their first damage payout. */
export function isCombatEntryEvent(event: { readonly type: string; readonly actorType?: string }): boolean {
  return (
    event.type === 'combat_start' ||
    (['damage', 'condition', 'control'].includes(event.type) && ['player', 'summon'].includes(String(event.actorType)))
  );
}

/** Identifies enemy-facing packets, which targeting options may suppress or delay independently of self effects. */
export function isHostileTargetEvent(event: { readonly type: string }): boolean {
  return HOSTILE_TARGET_EVENT_TYPES.has(event.type);
}

/** Combat Start blocks target damage and conditions; control skill-use notifications can still trigger relic buffs. */
export function isPrecombatTargetEffect(event: SimulationEvent): boolean {
  return event.type !== 'control' && isHostileTargetEvent(event);
}

/** Suppresses enemy-facing packets from a cast aimed away while retaining its setup and self effects. */
export function missesTarget(event: SimulationEvent): boolean {
  return event.offTarget === true && isHostileTargetEvent(event);
}

// Producers and consumers share runtime condition names without spelling aliases.
export const GW2_DAMAGING_CONDITIONS = Object.freeze([
  'Bleeding',
  'Burning',
  'Confusion',
  'Poisoned',
  'Torment'
] as const);
const DAMAGING_CONDITION_SET = new Set<string>(GW2_DAMAGING_CONDITIONS);

export const CANONICAL_TARGET_CONDITIONS = Object.freeze(
  [
    ...GW2_DAMAGING_CONDITIONS,
    'Blindness',
    'Chilled',
    'Crippled',
    'Fear',
    'Immobilized',
    'Slow',
    'Taunt',
    'Vulnerability',
    'Weakness'
  ].sort()
);

/**
 * Normalizes casing and whitespace; condition producers must use the canonical vocabulary.
 * Supplemental names retain a stable title-cased form without accepting obsolete synonyms.
 */
export function canonicalTargetConditionName(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return '';
  const normalized = text.toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/** Checks damaging-condition membership independently of casing and whitespace. */
export function isDamagingCondition(value: unknown): boolean {
  return DAMAGING_CONDITION_SET.has(canonicalTargetConditionName(value));
}

/** Effective intensity belongs to combat: non-damaging conditions represent presence, except Vulnerability. */
export function conditionStackLimit(name: string): number | null {
  return isDamagingCondition(name) ? null : canonicalTargetConditionName(name) === 'Vulnerability' ? 25 : 1;
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
 * Resolves a configured target condition independently of casing and whitespace.
 * Configured value or 0 if not found
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
    return Math.min(conditionStackLimit(name) ?? Infinity, Math.max(0, Number(value) || 0));
  };
}

/**
 * Gets stack count of permanent condition on target.
 * Boolean true converts to one stack; numeric values respect the condition intensity cap.
 * Stack count (≥0)
 * @example
 * permanentTargetConditionStacks(config, "Vulnerability") // → 2
 */
export function permanentTargetConditionStacks(config: Gw2Config, name: string): number {
  const value = configuredConditionValue(config, name);
  if (value === true) return 1;
  return Math.min(conditionStackLimit(name) ?? Infinity, Math.max(0, Number(value) || 0));
}

function activeRuntimeStackWeight(stack: Gw2RuntimeConditionStack, at: number): number {
  const appliedAt = stack.appliedAt ?? -Infinity;
  const expiresAt = stack.expiresAt ?? Infinity;
  const removedAt = stack.removedAt ?? Infinity;
  return isTimeInWindow(at, appliedAt, Math.min(expiresAt, removedAt))
    ? Math.max(0, stack.weight ?? stack.stacks ?? 0)
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
  // Runtime writers store canonical condition names, so queries need only one lookup.
  const entry = runtime.conditionState.get(canonicalName);
  return Math.min(
    conditionStackLimit(name) ?? Infinity,
    (entry?.stacks || []).reduce((sum, stack) => sum + activeRuntimeStackWeight(stack, at), 0)
  );
}

/**
 * Gets target-condition stacks from permanent scenario assumptions plus
 * chronological runtime applications. Live queries may supply their cached permanent count.
 */
export function targetConditionStacks(
  config: Gw2Config,
  name: string,
  at: number,
  runtime: Gw2RuntimeStateLike | null = null,
  permanentStacks = permanentTargetConditionStacks(config, name)
): number {
  const maximum = conditionStackLimit(name) ?? Infinity;
  // Permanent assumptions already at the cap cannot gain intensity from nonnegative live stacks.
  if (permanentStacks >= maximum) return maximum;
  return Math.min(maximum, permanentStacks + runtimeTargetConditionStacks(runtime, name, at || 0));
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

export interface Gw2TargetConfig {
  /** Detached previews hold this target-health state while retaining an unbounded damage recipient. */
  readonly fixedHealthFraction?: number;
  readonly conditions?: Readonly<Record<string, number | boolean>>;
  readonly health?: number;
  readonly startingHealthFraction?: number;
  readonly armor?: number;
  readonly moving?: boolean;
  /** A defiant golem never rotates, so it also stands in for flanking and behind-the-target bonuses. */
  readonly defiant?: boolean;
  /** Whether the target is casting; drives interrupt and activation-dependent rules. */
  readonly activatingSkills?: boolean;
  readonly confusionActivationsPerSecond?: number;
}

export interface Gw2RuntimeConditionStack {
  readonly appliedAt?: number;
  readonly expiresAt?: number;
  readonly removedAt?: number;
  readonly weight?: number;
  readonly stacks?: number;
}

export interface Gw2RuntimeConditionEntry {
  readonly stacks: Gw2RuntimeConditionStack[];
}

export interface Gw2RuntimeStateLike {
  readonly conditionState?: Map<string, Gw2RuntimeConditionEntry>;
  readonly totals?: {
    readonly strike?: number;
    readonly condition?: number;
  };
}
