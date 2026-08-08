import { buffMatchesAudience, sumActiveStacks } from "./boon-state.js";
import { criticalChance, criticalDamageMultiplier } from "./damage.js";
import { gw2EventActorType } from "./event-ownership.js";
import { clamp } from "./numeric.js";
import {
  createRelicTimelineRuntime,
  relicConditionDurationBonus,
  relicCriticalChanceBonus,
} from "./relic-rules.js";
import {
  gw2ConditionDurationMultiplier,
  gw2SigilSet,
  gw2StaticAttributes,
  MIGHT_ATTRIBUTE_BONUS_PER_STACK,
} from "./runtime-rules.js";
import { sigilCriticalContribution } from "./sigil-rules.js";
import {
  canonicalTargetConditionName,
  createPermanentTargetConditionStacks,
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
  Gw2BuffAudience,
  Gw2CombatQuery,
  Gw2Config,
  Gw2QueryRuntime,
  Gw2ResolverExtensions,
  Gw2ResolvedStats,
} from "./types.js";

interface TraitCatalog {
  readonly traits?: readonly CatalogEntity[];
}

interface CreateGw2CombatQueryOptions<TProfessionState extends object> {
  readonly profession?: NormalizedProfessionContract<TProfessionState>;
  readonly config?: Gw2Config;
  readonly events?: readonly SimulationEvent[];
  readonly traits?: ReadonlySet<string | number>;
  readonly conditionDurationBonus?: Gw2ResolverExtensions["conditionDurationBonus"];
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
 * conditions, and active equipment effects chronological instead of looking
 * ahead in the completed event stream.
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
  conditionDurationBonus,
}: CreateGw2CombatQueryOptions<TProfessionState> = {}): Readonly<Gw2CombatQuery> {
  if (!profession?.id) {
    throw new TypeError("GW2 combat query requires a profession.");
  }
  const activeProfession = profession;
  const configuredTargetConditionStacks =
    createPermanentTargetConditionStacks(config);
  const timeline = createGw2TimelineIndex({ config, events });
  const historicalRelicContext = Object.freeze({
    relic: createRelicTimelineRuntime(config.relic, events),
  });
  // Keep the exported standalone query backward compatible. Production
  // resolver composition supplies this capability explicitly.
  const equipmentConditionDurationBonus =
    conditionDurationBonus ||
    ((runtime: Gw2QueryRuntime | null | undefined, at: number): number =>
      relicConditionDurationBonus(
        runtime?.relic ? runtime : historicalRelicContext,
        at,
      ));
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
   * @param {Gw2BuffAudience} [audience]
   */
  const runtimeBuffStacks = (
    runtime: Gw2QueryRuntime | null | undefined,
    kind: string,
    time: number,
    maximum: number,
    audience: Gw2BuffAudience = "all",
  ): number | null =>
    runtime
      ? sumActiveStacks(
          runtime.boons?.get(kind) || [],
          (application) =>
            buffMatchesAudience(application, audience) &&
            application.at <= time &&
            application.expiresAt > time,
          (application) => Number(application.stacks || 1),
          maximum,
          (application) => application.at > time,
        )
      : null;

  /** Uses chronological runtime state when present, otherwise scheduled state. */
  const dynamicBoonStacksAt = (
    kind: string,
    time: number,
    maximum: number,
    runtime: Gw2QueryRuntime | null | undefined,
    audience: Gw2BuffAudience = "all",
    fallbackDuration = 0,
  ): number =>
    runtimeBuffStacks(runtime, kind, time, maximum, audience) ??
    timeline.buffStacksAt(kind, time, fallbackDuration, maximum, audience);
  /**
   * Player-configured permanent boons do not apply to ordinary summons.
   * Explicitly inherited companion profiles retain their existing behavior.
   *
   * @param {SimulationEvent | null | undefined} event
   */
  const isBoonIsolatedSummonEvent = (
    event: SimulationEvent | null | undefined,
  ): boolean =>
    gw2EventActorType(event) === "summon" &&
    event?.summonInheritsAttributes !== true &&
    event?.source !== "Phantasm";
  /**
   * @param {string} kind
   * @param {number} time
   * @param {number} maximum
   * @param {Gw2QueryRuntime | null | undefined} runtime
   * @param {SimulationEvent | null | undefined} event
   */
  const boonStacksAt = (
    kind: string,
    time: number,
    maximum: number,
    runtime: Gw2QueryRuntime | null | undefined,
    event: SimulationEvent | null | undefined,
  ): number => {
    const isolatedSummon = isBoonIsolatedSummonEvent(event);
    const configured = isolatedSummon ? 0 : Number(config.boons?.[kind] || 0);
    if (isolatedSummon && config.sharePlayerBoonsWithSummons === false) {
      return dynamicBoonStacksAt(kind, time, maximum, runtime, "summon-trait");
    }
    const dynamic = dynamicBoonStacksAt(kind, time, maximum, runtime, "all", 1);
    return clamp(configured + dynamic, 0, maximum);
  };
  /**
   * @param {number} time
   * @param {Gw2QueryRuntime | null | undefined} runtime
   * @param {SimulationEvent | null | undefined} event
   */
  const mightStacksAt = (
    time: number,
    runtime: Gw2QueryRuntime | null | undefined,
    event: SimulationEvent | null | undefined,
  ): number => boonStacksAt("might", time, 25, runtime, event);
  /**
   * @param {number} time
   * @param {Gw2QueryRuntime | null | undefined} runtime
   * @param {SimulationEvent | null | undefined} event
   */
  const furyActiveAt = (
    time: number,
    runtime: Gw2QueryRuntime | null | undefined,
    event: SimulationEvent | null | undefined,
  ): boolean => {
    const isolatedSummon = isBoonIsolatedSummonEvent(event);
    // Illusions inherit the summoner's base crit chance but never the
    // player-configured permanent Fury. They gain Fury only when a skill
    // applies it dynamically (handled by the runtime/timeline branch below).
    const illusionEvent =
      event?.source === "Clone" || event?.source === "Phantasm";
    if (!isolatedSummon && !illusionEvent && config.boons?.fury) return true;
    if (illusionEvent) {
      return (
        dynamicBoonStacksAt(
          "fury",
          time,
          1,
          runtime,
          config.sharePlayerBoonsWithSummons === false
            ? "summon-trait"
            : "summon",
        ) > 0
      );
    }
    if (isolatedSummon && config.sharePlayerBoonsWithSummons === false) {
      return dynamicBoonStacksAt("fury", time, 1, runtime, "summon-trait") > 0;
    }
    return dynamicBoonStacksAt("fury", time, 1, runtime) > 0;
  };
  /**
   * Independent summons consume only explicitly summon-targeted applications.
   */
  const summonMightStacksAt = (
    time: number,
    runtime: Gw2QueryRuntime | null | undefined,
  ): number =>
    dynamicBoonStacksAt(
      "might",
      time,
      25,
      runtime,
      config.sharePlayerBoonsWithSummons === false ? "summon-trait" : "summon",
    );
  /**
   * @param {number} time
   * @param {Gw2QueryRuntime | null | undefined} runtime
   */
  const vulnerabilityStacksAt = (
    time: number,
    runtime: Gw2QueryRuntime | null | undefined,
  ): number =>
    clamp(
      configuredTargetConditionStacks("Vulnerability") +
        runtimeTargetConditionStacks(runtime, "Vulnerability", time) +
        dynamicBoonStacksAt(
          "target-vulnerability",
          time,
          25,
          runtime,
          "all",
          1,
        ),
      0,
      25,
    );
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
    const permanent = configuredTargetConditionStacks(name);
    const runtimeStacks = runtimeTargetConditionStacks(runtime, name, time);
    if (name === "Vulnerability") {
      return vulnerabilityStacksAt(time, runtime);
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
  ) => gw2SigilSet(config, activeWeaponSetAt(time, runtime));
  const hookContext = (
    time: number,
    { event = null, condition = null, runtime = null }: HookContextOptions = {},
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
        mightStacksAt(time, runtime, event),
      ),
    ) as unknown as Gw2ResolvedStats;
    if (
      event?.independentSummonStrike === true &&
      event?.summonInheritsAttributes !== true &&
      Number.isFinite(Number(event.summonBasePower))
    ) {
      return {
        ...stats,
        power:
          Number(event.summonBasePower) +
          summonMightStacksAt(time, runtime) * MIGHT_ATTRIBUTE_BONUS_PER_STACK,
        precision: 1000,
        ferocity: 0,
      };
    }
    return stats;
  };

  const completedQuery: Readonly<Gw2CombatQuery> = Object.freeze({
    statsAt,
    mightStacksAt,
    furyActiveAt,
    vulnerabilityStacksAt,
    critical(
      event: SimulationEvent,
      time: number,
      runtime: Gw2QueryRuntime | null = null,
    ) {
      if (
        event?.independentSummonStrike === true &&
        event?.summonInheritsAttributes !== true
      ) {
        return {
          chance:
            event.canCrit === false || event.noCrit
              ? 0
              : clamp(Number(event.summonCriticalChance ?? 0.05), 0, 1),
          damage: Math.max(1, Number(event.summonCriticalDamage ?? 1.5)),
        };
      }
      const stats = statsAt(time, event, runtime);
      let chance = criticalChance(stats.precision);
      // Illusions inherit only the summoner's base (precision-derived) crit
      // chance. Player-only gear bonuses — configured crit-chance and weapon
      // sigils — do not carry over to them.
      const illusionEvent =
        event?.source === "Clone" || event?.source === "Phantasm";
      if (!illusionEvent) {
        chance += Number(config.stats?.criticalChanceBonus || 0) / 100;
        chance +=
          Number(activeSigilSetAt(time, runtime).criticalChanceBonus || 0) /
          100;
      }
      if (furyActiveAt(time, runtime, event)) chance += 0.25;
      chance = activeProfession.modifyCriticalChance(
        hookContext(time, { event, runtime }),
        chance,
      );
      chance += relicCriticalChanceBonus(
        runtime?.relic ? runtime : historicalRelicContext,
        event,
        mightStacksAt(time, runtime, event),
      );
      let damage = criticalDamageMultiplier(stats.ferocity);
      damage = activeProfession.modifyCriticalDamage(
        hookContext(time, { event, runtime }),
        damage,
      );
      const sigilCritical = sigilCriticalContribution(runtime, time);
      chance += sigilCritical.chance;
      damage += sigilCritical.damage;
      if (event.canCrit === false || event.noCrit) chance = 0;
      return {
        chance: clamp(chance, 0, 1),
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
      const relicBonus = equipmentConditionDurationBonus(runtime, time);
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
      return clamp(Number(modified || 1), 1, 2);
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
