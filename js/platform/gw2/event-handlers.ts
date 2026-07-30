import {
  conditionTickDamage,
  criticalChance,
  criticalDamageMultiplier,
  expectedCriticalMultiplier,
  strikeDamage,
} from "./damage.js";

import type {
  DirectResolverDamageField,
  DirectResolverState,
} from "../engine/resolver.js";
import type {
  NormalizedProfessionContract,
  SimulationEvent,
  SkillId,
} from "../engine/types.js";

/**
 * GW2-specific handlers for the engine's direct resolver.
 *
 * This module is the aggregate counterpart to
 * `./resolver/event-handlers.js`, which resolves a chronological GW2
 * timeline. Direct resolution charges an application's full condition damage
 * immediately and uses expected critical damage instead of rolling individual
 * hits. All handlers update the shared resolver state before notifying the
 * active profession's optional reaction for that event type.
 *
 * @module platform/gw2/event-handlers
 */

/**
 * The four offensive attributes consumed by direct damage resolution. The
 * numeric index signature keeps the shape assignable to the profession
 * contract's record-shaped modifier hooks.
 */
interface OffensiveAttributes {
  power: number;
  precision: number;
  ferocity: number;
  conditionDamage: number;
  [field: string]: number;
}

/**
 * Config fields read by the direct resolver. `attributes` is canonical;
 * `stats` remains a compatibility fallback for older callers.
 */
interface DirectResolverConfig {
  readonly attributes?: Partial<OffensiveAttributes>;
  readonly stats?: Partial<OffensiveAttributes>;
  readonly weaponStrength?: number;
  readonly targetArmor?: number;
  readonly target?: {
    readonly armor?: number;
    readonly moving?: boolean;
    readonly [field: string]: unknown;
  };
  readonly [field: string]: unknown;
}

/**
 * Direct-resolver context handed to each common handler. The index signature
 * lets the whole context flow into the profession contract's record-shaped
 * modifier hooks without per-call casts.
 */
export interface AggregateResolverContext {
  readonly profession: NormalizedProfessionContract;
  readonly config: DirectResolverConfig;
  readonly state: DirectResolverState;
  addBreakdown(
    id: SkillId,
    name: string,
    type: DirectResolverDamageField,
    damage: number,
    hits?: number,
  ): void;
  readonly [field: string]: unknown;
}

type AggregateReaction = (
  context: AggregateResolverContext,
  event: SimulationEvent,
  details?: Record<string, unknown>,
) => unknown;

type AggregateHandler = (
  context: AggregateResolverContext,
  event: SimulationEvent,
) => void;

/**
 * Passes a resolved event to its profession-owned reaction, when registered.
 * The details object contains values calculated by the common handler so a
 * profession does not need to repeat shared GW2 damage calculations.
 */
function react(
  context: AggregateResolverContext,
  event: SimulationEvent,
  details: Record<string, unknown> = {},
): unknown {
  // Common numeric work completes before the profession observes the event.
  const reaction = context.profession.eventReactions?.[event.type] as
    | AggregateReaction
    | undefined;
  return reaction?.(context, event, details);
}

/**
 * Reads the four offensive attributes used by direct damage resolution.
 * `config.attributes` is canonical; `config.stats` remains a compatibility
 * fallback for older callers.
 */
function attributes(context: AggregateResolverContext): OffensiveAttributes {
  // Accept both current stats and the older attributes config shape.
  const { attributes: configAttributes, stats } = context.config;
  return {
    power: Number(configAttributes?.power ?? stats?.power ?? 1000),
    precision: Number(configAttributes?.precision ?? stats?.precision ?? 1000),
    ferocity: Number(configAttributes?.ferocity ?? stats?.ferocity ?? 0),
    conditionDamage: Number(
      configAttributes?.conditionDamage ?? stats?.conditionDamage ?? 0,
    ),
  };
}

/**
 * Resolves an aggregate strike-damage event.
 *
 * Attribute and critical hooks run before strike modifiers. The resulting
 * expected damage is added to both the strike total and the per-source
 * breakdown, then exposed to the profession reaction as `details.damage` and
 * `details.hitContext`. A reaction may use `details.applyCondition` to route a
 * generated condition through the same direct accounting path.
 */
export function commonDamageHandler(
  context: AggregateResolverContext,
  event: SimulationEvent,
): void {
  const stats = context.profession.modifyAttributes(
    context,
    attributes(context),
  ) as unknown as OffensiveAttributes;
  // Critical chance/damage are fractional multipliers in this direct path.
  let chance = event.canCrit === false ? 0 : criticalChance(stats.precision);
  chance = context.profession.modifyCriticalChance(context, chance);
  let critical = criticalDamageMultiplier(stats.ferocity);
  critical = context.profession.modifyCriticalDamage(context, critical);
  const hits = Math.max(1, Number(event.hits || 1));
  const weaponStrength = Number(
    event.weaponStrength ?? context.config.weaponStrength ?? 1000,
  );
  let damage =
    strikeDamage(
      Number(event.coefficient),
      weaponStrength,
      stats.power,
      context.config.target?.armor ?? context.config.targetArmor ?? 2597,
    ) *
    hits *
    expectedCriticalMultiplier(chance, critical);
  // Profession modifiers receive the fully assembled expected strike.
  damage = context.profession.modifyStrikeDamage(context, damage);
  context.state.totals.strike += damage;
  context.addBreakdown(
    event.sourceId,
    event.skillName || String(event.sourceId),
    "strikeDamage",
    damage,
    hits,
  );
  const applyCondition = (
    _reactionContext: unknown,
    conditionEvent: SimulationEvent,
  ): void => commonConditionHandler(context, conditionEvent);
  // Reactions can apply a condition through the same common accounting path
  // without needing to know which context wrapper invoked them.
  react(context, event, {
    damage,
    hitContext: {
      damage,
      stats,
      critical: {
        chance,
        multiplier: critical,
      },
    },
    applyCondition,
    criticalChance: chance,
    criticalDamage: critical,
    stats,
  });
}

/**
 * Resolves the full lifetime damage of one condition application.
 *
 * Damage is calculated as tick damage multiplied by stacks and duration; this
 * path intentionally does not schedule ticks or truncate them at combat end.
 * The conditions map stores accumulated damage by condition name, not active
 * stack or duration state.
 */
export function commonConditionHandler(
  context: AggregateResolverContext,
  event: SimulationEvent,
): void {
  const stats = context.profession.modifyAttributes(
    context,
    attributes(context),
  ) as unknown as OffensiveAttributes;
  const condition = String(event.condition);
  // This handler is intentionally aggregate: stacks * seconds * tick damage.
  // Timestamp-aware partial ticks belong to resolver/condition-resolution.js.
  let damage =
    conditionTickDamage(condition, stats.conditionDamage) *
    Number(event.stacks) *
    Number(event.duration);
  damage = context.profession.modifyConditionDamage(context, damage);
  context.state.totals.condition += damage;
  context.addBreakdown(
    event.sourceId,
    event.skillName || String(event.sourceId),
    "conditionDamage",
    damage,
  );
  const current = context.state.conditions.get(condition) || 0;
  context.state.conditions.set(condition, current + damage);
  react(context, event, { damage, stats });
}

function reactingNoop(
  context: AggregateResolverContext,
  event: SimulationEvent,
): void {
  react(context, event);
}

/**
 * Records one boon application and reports the stacks active at the event
 * timestamp to the profession reaction. Expired applications remain stored as
 * history and are excluded only from the `activeStacks` calculation.
 */
function commonBuffHandler(
  context: AggregateResolverContext,
  event: SimulationEvent,
): void {
  const kind = String(event.kind || "").toLowerCase();
  const applications = context.state.boons.get(kind) || [];
  applications.push({
    at: event.at,
    expiresAt: event.at + Math.max(0, Number(event.duration || 0)),
    stacks: Math.max(1, Number(event.stacks || 1)),
  });
  // Retain expired applications for consumers that inspect historical state.
  context.state.boons.set(kind, applications);
  react(context, event, {
    activeStacks: applications
      .filter((application) => application.expiresAt > event.at)
      .reduce((sum, application) => sum + application.stacks, 0),
  });
}

/**
 * Creates the standard GW2 direct-resolver handler map.
 *
 * Numeric events mutate common damage or boon state. Other recognized events
 * deliberately perform no common mutation but still invoke profession
 * reactions. `proc` events are retained for reporting; their actual damage
 * must arrive as separate `damage` or `condition` events.
 *
 * The returned object is intended for
 * `HandlerRegistry.registerAll(createCommonEventHandlers())`.
 */
export function createCommonEventHandlers(): Record<string, AggregateHandler> {
  // Non-numeric events still react so profession behavior is consistent across
  // the direct and chronological resolver paths.
  return {
    action: reactingNoop,
    combat_start: reactingNoop,
    damage: commonDamageHandler,
    condition: commonConditionHandler,
    condition_tick: reactingNoop,
    control: reactingNoop,
    blind: reactingNoop,
    weapon_set: reactingNoop,
    sigil_swap: reactingNoop,
    marker: reactingNoop,
    resource: reactingNoop,
    buff: commonBuffHandler,
    weakness_vulnerability: reactingNoop,
    peitha: reactingNoop,
    proc: (context, event) => {
      // Proc events are reporting records; their damage is represented by
      // separate damage/condition events.
      context.state.procs.push(event);
      react(context, event);
    },
  };
}
