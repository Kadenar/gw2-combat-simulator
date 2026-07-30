import { criticalChance, criticalDamageMultiplier } from "./damage.js";
import { gw2EventActorType } from "./event-ownership.js";
import { relicConditionDurationBonus } from "./relic-rules.js";
import {
  gw2ConditionDurationMultiplier,
  gw2SigilSet,
  gw2StaticAttributes,
} from "./runtime-rules.js";
import {
  canonicalTargetConditionName,
  permanentTargetConditionStacks,
  runtimeTargetConditionStacks,
} from "./target-state.js";
import { createGw2TimelineIndex } from "./timeline-index.js";

import type {
  CanonicalCatalog,
  CatalogEntity,
  NormalizedProfessionContract,
  SchedulerRecord,
  SimulationEvent,
} from "../engine/types.js";
import type {
  Gw2CombatQuery,
  Gw2Config,
  Gw2QueryRuntime,
  Gw2ResolvedStats,
} from "./types.js";

interface TraitCatalog {
  readonly traits?: readonly CatalogEntity[];
}

interface CreateGw2CombatQueryOptions<
  TProfessionState extends object,
> {
  readonly profession?: NormalizedProfessionContract<TProfessionState>;
  readonly config?: Gw2Config;
  readonly events?: readonly SimulationEvent[];
  readonly traits?: ReadonlySet<string | number>;
}

interface HookContextOptions {
  readonly event?: SimulationEvent | null;
  readonly condition?: string | null;
  readonly runtime?: Gw2QueryRuntime | null;
}

/**
 * Carries both stable ids and names for every selected profession trait.
 *
 * @param {Gw2Config} [config]
 * @param {{readonly traits?: readonly CatalogEntity[]}} [catalog]
 * @returns {Set<string | number>}
 */
export function selectedGw2TraitValues(
  config: Gw2Config = {},
  catalog: TraitCatalog = {},
): Set<string | number> {
  const values = new Set<string | number>([
    ...(Array.isArray(config.traitIds) ? config.traitIds : []),
    ...(Array.isArray(config.selectedTraitIds) ? config.selectedTraitIds : []),
    ...(Array.isArray(config.selectedTraits) ? config.selectedTraits : []),
  ]);
  const byId = new Map<number, CatalogEntity>();
  const byName = new Map<string, CatalogEntity>();
  for (const trait of catalog?.traits || []) {
    byId.set(Number(trait.id), trait);
    byName.set(trait.name, trait);
  }
  for (const value of [...values]) {
    const trait =
      (typeof value === "string" ? byName.get(value) : undefined) ||
      byId.get(Number(value));
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
 *
 * @template {object} TProfessionState
 * @param {{
 *   profession?: NormalizedProfessionContract<TProfessionState>,
 *   config?: Gw2Config,
 *   events?: readonly SimulationEvent[],
 *   traits?: ReadonlySet<string | number>
 * }} [options]
 * @returns {Readonly<Gw2CombatQuery>}
 */
export function createGw2CombatQuery<
  TProfessionState extends object = SchedulerRecord,
>({
  profession,
  config = {},
  events = [],
  traits = selectedGw2TraitValues(config, profession?.catalog),
}: CreateGw2CombatQueryOptions<TProfessionState> = {}): Readonly<
  Gw2CombatQuery
> {
  if (!profession?.id) {
    throw new TypeError("GW2 combat query requires a profession.");
  }
  const activeProfession = profession;
  const timeline = createGw2TimelineIndex({ config, events });
  const configWithBaselineStats: Gw2Config = {
    ...config,
    stats: {
      ...config.stats,
      power: config.stats?.power ?? config.attributes?.power ?? 1000,
      precision:
        config.stats?.precision ?? config.attributes?.precision ?? 1000,
      toughness:
        config.stats?.toughness ?? config.attributes?.toughness ?? 1000,
      vitality: config.stats?.vitality ?? config.attributes?.vitality ?? 1000,
      ferocity: config.stats?.ferocity ?? config.attributes?.ferocity ?? 0,
      conditionDamage:
        config.stats?.conditionDamage ??
        config.attributes?.conditionDamage ??
        0,
      expertise: config.stats?.expertise ?? config.attributes?.expertise ?? 0,
      concentration:
        config.stats?.concentration ?? config.attributes?.concentration ?? 0,
      healingPower:
        config.stats?.healingPower ?? config.attributes?.healingPower ?? 0,
    },
  };
  let query: Readonly<Gw2CombatQuery> | null = null;

  /**
   * @param {Gw2QueryRuntime | null | undefined} runtime
   * @param {string} kind
   * @param {number} time
   * @param {number} maximum
   */
  const runtimeBuffStacks = (
    runtime: Gw2QueryRuntime | null | undefined,
    kind: string,
    time: number,
    maximum: number,
  ): number | null => {
    if (!runtime) return null;
    return Math.max(
      0,
      Math.min(
        maximum,
        (runtime.boons?.get(kind) || [])
          .filter(
            (application) =>
              application.at <= time && application.expiresAt > time,
          )
          .reduce(
            (sum, application) => sum + Number(application.stacks || 1),
            0,
          ),
      ),
    );
  };
  /**
   * @param {number} time
   * @param {Gw2QueryRuntime | null | undefined} runtime
   */
  const mightStacksAt = (
    time: number,
    runtime: Gw2QueryRuntime | null | undefined,
  ): number => {
    const dynamic = runtimeBuffStacks(runtime, "might", time, 25);
    if (dynamic == null) return timeline.mightStacksAt(time);
    return Math.min(25, Number(config.boons?.might || 0) + dynamic);
  };
  /**
   * @param {number} time
   * @param {Gw2QueryRuntime | null | undefined} runtime
   */
  const furyActiveAt = (
    time: number,
    runtime: Gw2QueryRuntime | null | undefined,
  ): boolean => {
    if (config.boons?.fury) return true;
    const dynamic = runtimeBuffStacks(runtime, "fury", time, 1);
    return dynamic == null ? timeline.furyActiveAt(time) : dynamic > 0;
  };
  /** @param {number} time */
  const summonMightStacksAt = (time: number): number => Math.min(
    25,
    events
      .filter(event =>
        event.type === "buff"
        && String(event.kind || "").toLowerCase() === "might"
        && event.affectsSummons === true
        && event.at <= time
        && event.at + Number(event.duration || 0) > time)
      .reduce((sum, event) => sum + Number(event.stacks || 1), 0),
  );
  /**
   * @param {number} time
   * @param {Gw2QueryRuntime | null | undefined} runtime
   */
  const vulnerabilityStacksAt = (
    time: number,
    runtime: Gw2QueryRuntime | null | undefined,
  ): number => {
    const buffStacks = runtimeBuffStacks(
      runtime,
      "target-vulnerability",
      time,
      25,
    );
    if (buffStacks == null) {
      return Math.min(
        25,
        timeline.vulnerabilityStacksAt(time) +
          runtimeTargetConditionStacks(runtime, "Vulnerability", time),
      );
    }
    return Math.min(
      25,
      permanentTargetConditionStacks(config, "Vulnerability") +
        runtimeTargetConditionStacks(runtime, "Vulnerability", time) +
        buffStacks,
    );
  };
  /**
   * @param {string} condition
   * @param {number} time
   * @param {Gw2QueryRuntime | null} [runtime]
   */
  const targetConditionStacksAt = (
    condition: string,
    time: number,
    runtime: Gw2QueryRuntime | null = null,
  ): number => {
    const name = canonicalTargetConditionName(condition);
    const permanent = permanentTargetConditionStacks(config, name);
    const runtimeStacks = runtimeTargetConditionStacks(runtime, name, time);
    if (name === "Vulnerability") {
      const dynamic = runtimeBuffStacks(
        runtime,
        "target-vulnerability",
        time,
        25,
      );
      const buffStacks =
        dynamic == null
          ? timeline.timedStacks("target-vulnerability", time, 1, 25)
          : dynamic;
      return Math.min(25, permanent + runtimeStacks + buffStacks);
    }
    return permanent + runtimeStacks;
  };
  /**
   * @param {number} time
   * @param {Gw2QueryRuntime | null | undefined} runtime
   */
  const activeWeaponSetAt = (
    time: number,
    runtime: Gw2QueryRuntime | null | undefined,
  ): number => {
    const runtimeSet = Number(runtime?.activeWeaponSet);
    return runtimeSet === 1 || runtimeSet === 2
      ? runtimeSet
      : timeline.activeWeaponSetAt(time);
  };
  /**
   * @param {number} time
   * @param {Gw2QueryRuntime | null | undefined} runtime
   */
  const activeSigilSetAt = (
    time: number,
    runtime: Gw2QueryRuntime | null | undefined,
  ) =>
    gw2SigilSet(config, activeWeaponSetAt(time, runtime));
  const hookContext = (
    time: number,
    {
      event = null,
      condition = null,
      runtime = null,
    }: HookContextOptions = {},
  ): SchedulerRecord => ({
    profession: activeProfession,
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
  });
  /**
   * @param {number} time
   * @param {SimulationEvent | null} [event]
   * @param {Gw2QueryRuntime | null} [runtime]
   * @returns {Gw2ResolvedStats}
   */
  const statsAt = (
    time: number,
    event: SimulationEvent | null = null,
    runtime: Gw2QueryRuntime | null = null,
  ): Gw2ResolvedStats => {
    const stats = activeProfession.modifyAttributes(
      hookContext(time, { event, runtime }),
      gw2StaticAttributes(
        configWithBaselineStats,
        mightStacksAt(time, runtime),
      ),
    ) as unknown as Gw2ResolvedStats;
    if (
      event?.independentSummonStrike === true
      && event?.summonInheritsAttributes !== true
      && Number.isFinite(Number(event.summonBasePower))
    ) {
      return {
        ...stats,
        power:
          Number(event.summonBasePower)
          + summonMightStacksAt(time) * 30,
        precision: 1000,
        ferocity: 0,
      };
    }
    return stats;
  };

  const completedQuery: Readonly<Gw2CombatQuery> = Object.freeze({
    statsAt,
    critical(
      event: SimulationEvent,
      time: number,
      runtime: Gw2QueryRuntime | null = null,
    ) {
      if (
        event?.independentSummonStrike === true
        && event?.summonInheritsAttributes !== true
      ) {
        return {
          chance:
            event.canCrit === false || event.noCrit
              ? 0
              : Math.max(
                0,
                Math.min(1, Number(event.summonCriticalChance ?? 0.05)),
              ),
          damage: Math.max(1, Number(event.summonCriticalDamage ?? 1.5)),
        };
      }
      const stats = statsAt(time, event, runtime);
      let chance = criticalChance(stats.precision);
      chance += Number(config.stats?.criticalChanceBonus || 0) / 100;
      chance +=
        Number(activeSigilSetAt(time, runtime).criticalChanceBonus || 0) / 100;
      if (furyActiveAt(time, runtime)) chance += 0.25;
      chance = activeProfession.modifyCriticalChance(
        hookContext(time, { event, runtime }),
        chance,
      );
      let damage = criticalDamageMultiplier(stats.ferocity);
      damage = activeProfession.modifyCriticalDamage(
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
    strikeMultiplier(
      event: SimulationEvent,
      time: number,
      runtime: Gw2QueryRuntime | null = null,
    ) {
      if (event?.independentSummonStrike === true) {
        const base = 1 + vulnerabilityStacksAt(time, runtime) / 100;
        return event?.summonUsesProfessionModifiers === true
          ? activeProfession.modifyStrikeDamage(
              hookContext(time, { event, runtime }),
              base,
            )
          : base;
      }
      const base =
        (1 + vulnerabilityStacksAt(time, runtime) / 100) *
        Number(activeSigilSetAt(time, runtime).strike || 1) *
        Number(config.modifiers?.strike || 1);
      return activeProfession.modifyStrikeDamage(
        hookContext(time, { event, runtime }),
        base,
      );
    },
    conditionMultiplier(
      name: string,
      time: number,
      event: SimulationEvent | null = null,
      runtime: Gw2QueryRuntime | null = null,
    ) {
      const base =
        (1 + vulnerabilityStacksAt(time, runtime) / 100) *
        Number(activeSigilSetAt(time, runtime).condition || 1) *
        Number(config.modifiers?.condition || 1);
      return activeProfession.modifyConditionDamage(
        hookContext(time, {
          event,
          condition: name,
          runtime,
        }),
        base,
      );
    },
    conditionDurationMultiplier(
      name: string,
      time: number,
      stats: Gw2ResolvedStats = statsAt(time),
      event: SimulationEvent | null = null,
      runtime: Gw2QueryRuntime | null = null,
    ) {
      const sigils = activeSigilSetAt(time, runtime);
      const sigilBonus =
        (Number(sigils.conditionDurationBonus || 0) +
          Number(sigils.conditionDurationBonuses?.[name] || 0)) /
        100;
      const relicBonus =
        relicConditionDurationBonus(runtime, time) +
        (config.relic === "Aristocracy"
          ? timeline.aristocracyStacksAt(time) * 0.03
          : 0);
      const base = gw2ConditionDurationMultiplier(
        name,
        stats,
        sigilBonus + relicBonus,
      );
      const modified = activeProfession.modifyConditionDuration(
        hookContext(time, {
          event,
          condition: name,
          runtime,
        }),
        base,
      );
      return Math.max(1, Math.min(2, Number(modified || 1)));
    },
    conditionBaseDurationMultiplier(
      name: string,
      time: number,
      event: SimulationEvent | null = null,
      runtime: Gw2QueryRuntime | null = null,
    ) {
      return Math.max(
        0,
        Number(
          activeProfession.modifyConditionBaseDuration(
            hookContext(time, {
              event,
              condition: name,
              runtime,
            }),
            1,
          ) || 0,
        ),
      );
    },
    targetConditionStacks: targetConditionStacksAt,
    targetHasCondition(
      condition: string,
      time: number,
      runtime: Gw2QueryRuntime | null = null,
    ) {
      return targetConditionStacksAt(condition, time, runtime) > 0;
    },
    activeWeaponSetAt: timeline.activeWeaponSetAt,
    activeSigilSetAt: timeline.activeSigilSetAt,
    timedStacks: timeline.timedStacks,
    timeline,
  });
  query = completedQuery;
  return completedQuery;
}
