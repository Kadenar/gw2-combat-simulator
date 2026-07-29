import {
  conditionTickDamage,
  criticalChance,
  criticalDamageMultiplier,
  expectedCriticalMultiplier,
  strikeDamage,
} from "./damage.js";

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
 * Passes a resolved event to its profession-owned reaction, when registered.
 * The details object contains values calculated by the common handler so a
 * profession does not need to repeat shared GW2 damage calculations.
 *
 * @param {object} context Direct resolver context.
 * @param {object} event Event currently being resolved.
 * @param {object} [details={}] Common resolution values exposed to the reaction.
 * @returns {*} The reaction's return value, or `undefined` when none exists.
 */

function react(context, event, details = {}) {
  // Common numeric work completes before the profession observes the event.
  return context.profession.eventReactions?.[event.type]?.(
    context,
    event,
    details,
  );
}

/**
 * Reads the four offensive attributes used by direct damage resolution.
 * `config.attributes` is canonical; `config.stats` remains a compatibility
 * fallback for older callers.
 *
 * @param {object} context Direct resolver context.
 * @returns {{power: number, precision: number, ferocity: number, conditionDamage: number}}
 */
function attributes(context) {
  // Accept both current stats and the older attributes config shape.
  return {
    power: Number(
      context.config.attributes?.power ?? context.config.stats?.power ?? 1000,
    ),
    precision: Number(
      context.config.attributes?.precision ??
        context.config.stats?.precision ??
        1000,
    ),
    ferocity: Number(
      context.config.attributes?.ferocity ??
        context.config.stats?.ferocity ??
        0,
    ),
    conditionDamage: Number(
      context.config.attributes?.conditionDamage ??
        context.config.stats?.conditionDamage ??
        0,
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
 *
 * Expected event fields:
 * - `coefficient`: strike coefficient for one hit.
 * - `sourceId`: stable source identifier used by the damage breakdown.
 * - `skillName`: optional display name; falls back to `sourceId`.
 * - `hits`: optional hit count, with a minimum/default of one.
 * - `weaponStrength`: optional per-event override of configured strength.
 * - `canCrit`: set to `false` to suppress expected critical damage.
 *
 * @param {object} context Direct resolver context.
 * @param {object} event Aggregate strike event.
 * @returns {void}
 */
export function commonDamageHandler(context, event) {
  const stats = context.profession.modifyAttributes(
    context,
    attributes(context),
  );
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
      event.coefficient,
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
  const applyCondition = (_reactionContext, conditionEvent) =>
    commonConditionHandler(context, conditionEvent);
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
 *
 * Expected event fields:
 * - `condition`: condition name accepted by `conditionTickDamage`.
 * - `stacks`: number of stacks applied.
 * - `duration`: full application duration in seconds.
 * - `sourceId`: stable source identifier used by the damage breakdown.
 * - `skillName`: optional display name; falls back to `sourceId`.
 *
 * @param {object} context Direct resolver context.
 * @param {object} event Aggregate condition event.
 * @returns {void}
 */
export function commonConditionHandler(context, event) {
  const stats = context.profession.modifyAttributes(
    context,
    attributes(context),
  );
  // This handler is intentionally aggregate: stacks * seconds * tick damage.
  // Timestamp-aware partial ticks belong to resolver/condition-resolution.js.
  let damage =
    conditionTickDamage(event.condition, stats.conditionDamage, {
      stationary: context.config.target?.moving !== true,
    }) *
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
  const current = context.state.conditions.get(event.condition) || 0;
  context.state.conditions.set(event.condition, current + damage);
  react(context, event, { damage, stats });
}

function reactingNoop(context, event) {
  react(context, event);
}

/**
 * Records one boon application and reports the stacks active at the event
 * timestamp to the profession reaction. Expired applications remain stored as
 * history and are excluded only from the `activeStacks` calculation.
 *
 * @param {object} context Direct resolver context.
 * @param {object} event Boon event with `kind`, `at`, `duration`, and `stacks`.
 * @returns {void}
 */
function commonBuffHandler(context, event) {
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
 *
 * @returns {Record<string, (context: object, event: object) => void>}
 * Event-type-to-handler map.
 */
export function createCommonEventHandlers() {
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
