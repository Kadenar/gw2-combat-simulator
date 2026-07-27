import {
  criticalChance,
  criticalDamageMultiplier,
} from "./damage.js";
import { gw2EventActorType } from "./event-ownership.js";
import { relicConditionDurationBonus } from "./relic-rules.js";
import {
  gw2ConditionDurationMultiplier,
  gw2SigilSet,
  gw2StaticAttributes,
} from "./runtime-rules.js";
import { permanentTargetConditionStacks } from "./target-state.js";
import { createGw2TimelineIndex } from "./timeline-index.js";

/**
 * Carries both stable ids and names for every selected profession trait.
 */
export function selectedGw2TraitValues(config = {}, catalog = {}) {
  const values = new Set([
    ...(Array.isArray(config.traitIds) ? config.traitIds : []),
    ...(Array.isArray(config.selectedTraitIds)
      ? config.selectedTraitIds
      : []),
    ...(Array.isArray(config.selectedTraits) ? config.selectedTraits : []),
  ]);
  const byId = new Map();
  const byName = new Map();
  for (const trait of catalog?.traits || []) {
    byId.set(Number(trait.id), trait);
    byName.set(trait.name, trait);
  }
  for (const value of [...values]) {
    const trait = byName.get(value) || byId.get(Number(value));
    if (trait) {
      values.add(Number(trait.id));
      values.add(trait.name);
    }
  }
  return values;
}

/**
 * Builds the timestamp-aware combat facts shared by scheduling and resolution.
 * A supplied runtime makes same-timestamp buffs, weapon sets, profession state,
 * conditions, and Severance chronological instead of looking ahead in the
 * completed event stream.
 */
export function createGw2CombatQuery({
  profession,
  config = {},
  events = [],
  traits = selectedGw2TraitValues(config, profession?.catalog),
} = {}) {
  if (!profession?.id) {
    throw new TypeError("GW2 combat query requires a profession.");
  }
  const timeline = createGw2TimelineIndex({ config, events });
  const configWithBaselineStats = {
    ...config,
    stats: {
      ...config.stats,
      power:
        config.stats?.power ?? config.attributes?.power ?? 1000,
      precision:
        config.stats?.precision ?? config.attributes?.precision ?? 1000,
      toughness:
        config.stats?.toughness ?? config.attributes?.toughness ?? 1000,
      vitality:
        config.stats?.vitality ?? config.attributes?.vitality ?? 1000,
      ferocity:
        config.stats?.ferocity ?? config.attributes?.ferocity ?? 0,
      conditionDamage:
        config.stats?.conditionDamage
        ?? config.attributes?.conditionDamage
        ?? 0,
      expertise:
        config.stats?.expertise ?? config.attributes?.expertise ?? 0,
      concentration:
        config.stats?.concentration ?? config.attributes?.concentration ?? 0,
      healingPower:
        config.stats?.healingPower ?? config.attributes?.healingPower ?? 0,
    },
  };
  let query;

  const runtimeBuffStacks = (runtime, kind, time, maximum) => {
    if (!runtime) return null;
    return Math.max(
      0,
      Math.min(
        maximum,
        (runtime.boons?.get(kind) || [])
          .filter(application =>
            application.at <= time
            && application.expiresAt > time)
          .reduce(
            (sum, application) =>
              sum + Number(application.stacks || 1),
            0,
          ),
      ),
    );
  };
  const mightStacksAt = (time, runtime) => {
    const dynamic = runtimeBuffStacks(runtime, "might", time, 25);
    if (dynamic == null) return timeline.mightStacksAt(time);
    return Math.min(25, Number(config.boons?.might || 0) + dynamic);
  };
  const furyActiveAt = (time, runtime) => {
    if (config.boons?.fury) return true;
    const dynamic = runtimeBuffStacks(runtime, "fury", time, 1);
    return dynamic == null
      ? timeline.furyActiveAt(time)
      : dynamic > 0;
  };
  const vulnerabilityStacksAt = (time, runtime) => {
    const dynamic = runtimeBuffStacks(
      runtime,
      "target-vulnerability",
      time,
      25,
    );
    if (dynamic == null) return timeline.vulnerabilityStacksAt(time);
    const permanent = permanentTargetConditionStacks(
      config,
      "Vulnerability",
    );
    return Math.min(25, permanent + dynamic);
  };
  const activeWeaponSetAt = (time, runtime) => {
    const runtimeSet = Number(runtime?.activeWeaponSet);
    return runtimeSet === 1 || runtimeSet === 2
      ? runtimeSet
      : timeline.activeWeaponSetAt(time);
  };
  const activeSigilSetAt = (time, runtime) =>
    gw2SigilSet(config, activeWeaponSetAt(time, runtime));
  const hookContext = (
    time,
    {
      event = null,
      condition = null,
      runtime = null,
    } = {},
  ) => ({
    profession,
    config,
    time,
    event,
    skillId: event?.skillId ?? null,
    sourceId: event?.sourceId ?? null,
    actorType: event ? gw2EventActorType(event) : null,
    condition,
    traits,
    query,
    timeline,
    events,
    runtime,
    state: runtime?.state ?? null,
  });
  const statsAt = (time, event = null, runtime = null) =>
    profession.modifyAttributes(
      hookContext(time, { event, runtime }),
      gw2StaticAttributes(
        configWithBaselineStats,
        mightStacksAt(time, runtime),
      ),
    );

  query = Object.freeze({
    statsAt,
    critical(event, time, runtime = null) {
      const stats = statsAt(time, event, runtime);
      let chance = criticalChance(stats.precision);
      chance += Number(config.stats?.criticalChanceBonus || 0) / 100;
      chance +=
        Number(activeSigilSetAt(time, runtime).criticalChanceBonus || 0)
        / 100;
      if (furyActiveAt(time, runtime)) chance += 0.25;
      chance = profession.modifyCriticalChance(
        hookContext(time, { event, runtime }),
        chance,
      );
      let damage = criticalDamageMultiplier(stats.ferocity);
      damage = profession.modifyCriticalDamage(
        hookContext(time, { event, runtime }),
        damage,
      );
      if (Number(runtime?.sigil?.severanceUntil || 0) > time) {
        chance += 250 / 2100;
        damage += 250 / 1500;
      }
      if (event.canCrit === false || event.noCrit) chance = 0;
      return {
        chance: Math.max(0, Math.min(1, chance)),
        damage: Math.max(1, Number(damage || 1)),
      };
    },
    strikeMultiplier(event, time, runtime = null) {
      const base =
        (1 + vulnerabilityStacksAt(time, runtime) / 100)
        * Number(activeSigilSetAt(time, runtime).strike || 1)
        * Number(config.modifiers?.strike || 1);
      return profession.modifyStrikeDamage(
        hookContext(time, { event, runtime }),
        base,
      );
    },
    conditionMultiplier(name, time, event = null, runtime = null) {
      const base =
        (1 + vulnerabilityStacksAt(time, runtime) / 100)
        * Number(activeSigilSetAt(time, runtime).condition || 1)
        * Number(config.modifiers?.condition || 1);
      return profession.modifyConditionDamage(
        hookContext(time, {
          event,
          condition: name,
          runtime,
        }),
        base,
      );
    },
    conditionDurationMultiplier(
      name,
      time,
      stats = statsAt(time),
      event = null,
      runtime = null,
    ) {
      const sigils = activeSigilSetAt(time, runtime);
      const sigilBonus = (
        Number(sigils.conditionDurationBonus || 0)
        + Number(sigils.conditionDurationBonuses?.[name] || 0)
      ) / 100;
      const relicBonus =
        relicConditionDurationBonus(runtime, time)
        + (
          config.relic === "Aristocracy"
            ? timeline.aristocracyStacksAt(time) * 0.03
            : 0
        );
      const base = gw2ConditionDurationMultiplier(
        name,
        stats,
        sigilBonus + relicBonus,
      );
      const modified = profession.modifyConditionDuration(
        hookContext(time, {
          event,
          condition: name,
          runtime,
        }),
        base,
      );
      return Math.max(1, Math.min(2, Number(modified || 1)));
    },
    activeWeaponSetAt: timeline.activeWeaponSetAt,
    activeSigilSetAt: timeline.activeSigilSetAt,
    timedStacks: timeline.timedStacks,
    timeline,
  });
  return query;
}
