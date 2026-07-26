import {
  conditionTickDamage,
  criticalChance,
  criticalDamageMultiplier,
  expectedCriticalMultiplier,
  strikeDamage,
} from "./damage.js";

function react(context, event, details = {}) {
  return context.profession.eventReactions?.[event.type]?.(
    context,
    event,
    details,
  );
}

function attributes(context) {
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
  context.state.boons.set(kind, applications);
  react(context, event, {
    activeStacks: applications
      .filter(application => application.expiresAt > event.at)
      .reduce((sum, application) => sum + application.stacks, 0),
  });
}

export function createCommonEventHandlers() {
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
      context.state.procs.push(event);
      react(context, event);
    },
  };
}
