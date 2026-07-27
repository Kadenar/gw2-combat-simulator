import {
  conditionTickDamage,
  criticalChance,
  criticalDamageMultiplier,
  expectedCriticalMultiplier,
  strikeDamage,
} from "./damage.js";

// Direct-resolution handlers for callers that do not use resolver event
// queues. In this model a condition's whole duration is charged immediately.

function react(context, event, details = {}) {
  // Common numeric work completes before the profession observes the event.
  return context.profession.eventReactions?.[event.type]?.(
    context,
    event,
    details,
  );
}

function attributes(context) {
  // Accept both current stats and the older attributes config shape.
  return {
    power: Number(context.config.attributes?.power ?? context.config.stats?.power ?? 1000),
    precision: Number(
      context.config.attributes?.precision
      ?? context.config.stats?.precision
      ?? 1000,
    ),
    ferocity: Number(
      context.config.attributes?.ferocity
      ?? context.config.stats?.ferocity
      ?? 0,
    ),
    conditionDamage: Number(
      context.config.attributes?.conditionDamage
      ?? context.config.stats?.conditionDamage
      ?? 0,
    ),
  };
}

export function commonDamageHandler(context, event) {
  const stats = context.profession.modifyAttributes(context, attributes(context));
  // Critical chance/damage are fractional multipliers in this direct path.
  let chance = event.canCrit === false ? 0 : criticalChance(stats.precision);
  chance = context.profession.modifyCriticalChance(context, chance);
  let critical = criticalDamageMultiplier(stats.ferocity);
  critical = context.profession.modifyCriticalDamage(context, critical);
  const hits = Math.max(1, Number(event.hits || 1));
  const weaponStrength = Number(
    event.weaponStrength
    ?? context.config.weaponStrength
    ?? 1000,
  );
  let damage = strikeDamage(
    event.coefficient,
    weaponStrength,
    stats.power,
    context.config.target?.armor ?? context.config.targetArmor ?? 2597,
  ) * hits * expectedCriticalMultiplier(chance, critical);
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

export function commonConditionHandler(context, event) {
  const stats = context.profession.modifyAttributes(context, attributes(context));
  // This handler is intentionally aggregate: stacks * seconds * tick damage.
  // Timestamp-aware partial ticks belong to resolver/condition-resolution.js.
  let damage = conditionTickDamage(
    event.condition,
    stats.conditionDamage,
    { stationary: context.config.target?.moving !== true },
  ) * Number(event.stacks) * Number(event.duration);
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
      .filter(application => application.expiresAt > event.at)
      .reduce((sum, application) => sum + application.stacks, 0),
  });
}

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
