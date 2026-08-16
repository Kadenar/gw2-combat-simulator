import { buffMatchesAudience, sumActiveStacks } from "./boon-state.js";
import { criticalChance, criticalDamageMultiplier } from "./damage.js";
import { gw2EventActorType } from "./event-ownership.js";
import { clamp } from "./numeric.js";
import {
  createRelicTimelineRuntime,
  relicConditionDurationBonus,
  relicCriticalChanceBonus,
  relicOutgoingDamageBonus,
} from "./relic-rules.js";
import {
  gw2ConditionDurationMultiplier,
  gw2SigilSet,
  gw2StatsForWeaponSet,
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
  CatalogEntity,
  NormalizedProfessionContract,
  SchedulerRecord,
  SimulationEvent,
} from "../engine/types.js";
import type {
  Gw2BuffAudience,
  Gw2CombatQuery,
  Gw2Config,
  Gw2CriticalChanceContributor,
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
  readonly damageAdditiveBonus?: number;
  readonly criticalChanceContributors?: Gw2CriticalChanceContributor[];
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
  const configWithBaselineStats = (weaponSet: number): Gw2Config => {
    const stats = gw2StatsForWeaponSet(config, weaponSet);
    return {
      ...config,
      stats: {
        ...stats,
        power: stats.power ?? 1000,
        precision: stats.precision ?? 1000,
        toughness: stats.toughness ?? 1000,
        vitality: stats.vitality ?? 1000,
        ferocity: stats.ferocity ?? 0,
        conditionDamage: stats.conditionDamage ?? 0,
        expertise: stats.expertise ?? 0,
        concentration: stats.concentration ?? 0,
        healingPower: stats.healingPower ?? 0,
      },
    };
  };
  const startingWeaponSet = Number(config.startingWeaponSet) === 2 ? 2 : 1;
  const staticConfig = configWithBaselineStats(startingWeaponSet);
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
    companionId: string | null = null,
  ): number | null =>
    runtime
      ? sumActiveStacks(
          // Scheduler and resolver runtimes append applications in
          // chronological event-queue order. The stop predicate depends on
          // that ordering so future applications can terminate the scan.
          runtime.boons?.get(kind) || [],
          (application) =>
            buffMatchesAudience(application, audience, companionId) &&
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
    companionId: string | null = null,
  ): number =>
    runtimeBuffStacks(runtime, kind, time, maximum, audience, companionId) ??
    timeline.buffStacksAt(
      kind,
      time,
      fallbackDuration,
      maximum,
      audience,
      companionId,
    );
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
  const summonCompanionId = (
    event: SimulationEvent | null | undefined,
  ): string | null => {
    if (!event || gw2EventActorType(event) !== "summon") return null;
    if (event.summonOwner) return String(event.summonOwner);
    if (event.cloneId != null) return `mesmer.clone:${String(event.cloneId)}`;
    if (event.source === "ranger-pet") return "ranger-pet";
    return null;
  };
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
    if (isolatedSummon) {
      return dynamicBoonStacksAt(
        kind,
        time,
        maximum,
        runtime,
        "summon",
        0,
        summonCompanionId(event),
      );
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
    const inheritsOwnerCriticalState =
      event?.summonInheritsAttributes === true ||
      event?.summonInheritsCriticalAttributes === true;
    // Illusions inherit the summoner's base crit chance but never the
    // player-configured permanent Fury. They gain Fury only when a skill
    // applies it dynamically (handled by the runtime/timeline branch below).
    const illusionEvent =
      event?.source === "Clone" || event?.source === "Phantasm";
    if (
      (!isolatedSummon || inheritsOwnerCriticalState) &&
      !illusionEvent &&
      config.boons?.fury
    ) {
      return true;
    }
    if (illusionEvent || (isolatedSummon && !inheritsOwnerCriticalState)) {
      return (
        dynamicBoonStacksAt(
          "fury",
          time,
          1,
          runtime,
          "summon",
          0,
          summonCompanionId(event),
        ) > 0
      );
    }
    return dynamicBoonStacksAt("fury", time, 1, runtime) > 0;
  };
  /**
   * Independent summons consume only explicitly summon-targeted applications.
   */
  const summonMightStacksAt = (
    time: number,
    runtime: Gw2QueryRuntime | null | undefined,
    event: SimulationEvent | null | undefined,
  ): number =>
    dynamicBoonStacksAt(
      "might",
      time,
      25,
      runtime,
      "summon",
      0,
      summonCompanionId(event),
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
    if (name === "Vulnerability") {
      return vulnerabilityStacksAt(time, runtime);
    }
    return (
      configuredTargetConditionStacks(name) +
      runtimeTargetConditionStacks(runtime, name, time)
    );
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
  const activeConfigAt = (
    time: number,
    runtime: Gw2QueryRuntime | null | undefined,
  ): Gw2Config => {
    if (!config.weaponSetStats?.length) return staticConfig;
    const weaponSet = activeWeaponSetAt(time, runtime);
    const activeConfig = configWithBaselineStats(weaponSet);
    const calculatedPrimaryWeapon =
      (weaponSet === 2 ? config.weaponSet2Primary : config.primaryWeapon) || "";
    return {
      ...activeConfig,
      attributeProvenance: {
        ...(config.attributeProvenance || {}),
        calculatedWeaponSet: weaponSet,
        calculatedPrimaryWeapon,
      },
    };
  };
  const hookContext = (
    time: number,
    {
      event = null,
      condition = null,
      runtime = null,
      damageAdditiveBonus = 0,
      criticalChanceContributors,
    }: HookContextOptions = {},
  ): SchedulerRecord => ({
    profession: activeProfession,
    config: activeConfigAt(time, runtime),
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
    damageAdditiveBonus,
    criticalChanceContributors,
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
    const activeConfig = activeConfigAt(time, runtime);
    const stats = activeProfession.modifyAttributes(
      hookContext(time, { event, runtime }),
      gw2StaticAttributes(
        activeConfig,
        mightStacksAt(time, runtime, event),
        activeWeaponSetAt(time, runtime),
      ),
    ) as unknown as Gw2ResolvedStats;
    if (
      event?.independentSummonStrike === true &&
      event?.summonInheritsAttributes !== true &&
      Number.isFinite(Number(event.summonBasePower))
    ) {
      const inheritCriticalAttributes =
        event.summonInheritsCriticalAttributes === true;
      const summonMightStacks = summonMightStacksAt(time, runtime, event);
      return {
        ...stats,
        power:
          Number(event.summonBasePower) +
          summonMightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK,
        precision: inheritCriticalAttributes
          ? stats.precision
          : Number(event.summonBasePrecision ?? 1000),
        ferocity: inheritCriticalAttributes
          ? stats.ferocity
          : Number(event.summonBaseFerocity ?? 0),
        conditionDamage:
          Number(event.summonBaseConditionDamage ?? stats.conditionDamage) +
          summonMightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK,
        expertise: Number(event.summonBaseExpertise ?? stats.expertise),
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
        event?.summonInheritsAttributes !== true &&
        event?.summonInheritsCriticalAttributes !== true
      ) {
        const summonFuryBonus = furyActiveAt(time, runtime, event) ? 0.25 : 0;
        const baseChance =
          Number(event.summonCriticalChance ?? 0.05) + summonFuryBonus;
        const chance =
          event.summonUsesProfessionModifiers === true
            ? activeProfession.modifyCriticalChance(
                hookContext(time, { event, runtime }),
                baseChance,
              )
            : baseChance;
        return {
          chance:
            event.canCrit === false || event.noCrit ? 0 : clamp(chance, 0, 1),
          damage: Math.max(1, Number(event.summonCriticalDamage ?? 1.5)),
        };
      }
      const stats = statsAt(time, event, runtime);
      let contributors: Gw2CriticalChanceContributor[] = [];
      const addContributor = (id: string, label: string, amount: number) => {
        if (Math.abs(amount) <= Number.EPSILON) return;
        contributors.push({ id, label, amount });
      };
      let chance = criticalChance(stats.precision);
      addContributor("precision", "Precision", chance);
      // Illusions inherit only the summoner's base (precision-derived) crit
      // chance. Player-only gear bonuses — configured crit-chance and weapon
      // sigils — do not carry over to them.
      const illusionEvent =
        event?.source === "Clone" || event?.source === "Phantasm";
      if (!illusionEvent) {
        const configuredBonus =
          Number(
            activeConfigAt(time, runtime).stats?.criticalChanceBonus || 0,
          ) / 100;
        chance += configuredBonus;
        addContributor("configured-bonus", "Configured bonus", configuredBonus);
        const sigilBonus =
          Number(activeSigilSetAt(time, runtime).criticalChanceBonus || 0) /
          100;
        chance += sigilBonus;
        addContributor("active-sigils", "Active weapon sigils", sigilBonus);
      }
      if (furyActiveAt(time, runtime, event)) {
        chance += 0.25;
        addContributor("fury", "Fury", 0.25);
      }
      const professionContributors: Gw2CriticalChanceContributor[] = [];
      const beforeProfession = chance;
      chance = activeProfession.modifyCriticalChance(
        hookContext(time, {
          event,
          runtime,
          criticalChanceContributors: professionContributors,
        }),
        chance,
      );
      const tracedProfessionAmount = professionContributors.reduce(
        (sum, contributor) => sum + contributor.amount,
        0,
      );
      contributors.push(...professionContributors);
      addContributor(
        "profession-effects",
        "Other profession effects",
        chance - beforeProfession - tracedProfessionAmount,
      );
      const relicBonus = relicCriticalChanceBonus(
        runtime?.relic ? runtime : historicalRelicContext,
        event,
        mightStacksAt(time, runtime, event),
      );
      chance += relicBonus;
      addContributor("relic", "Relic", relicBonus);
      let damage = criticalDamageMultiplier(stats.ferocity);
      damage = activeProfession.modifyCriticalDamage(
        hookContext(time, { event, runtime }),
        damage,
      );
      const sigilCritical = sigilCriticalContribution(runtime, time);
      chance += sigilCritical.chance;
      addContributor(
        "sigil-severance",
        "Sigil of Severance",
        sigilCritical.chance,
      );
      damage += sigilCritical.damage;
      let chanceBeforeCap = chance;
      if (event.canCrit === false || event.noCrit) chance = 0;
      // Skills flagged forceCrit (e.g. Wild Blow) always land a critical hit,
      // independent of precision. This overrides every other crit gate.
      if (event.forceCrit) {
        chance = 1;
        chanceBeforeCap = 1;
        contributors = [
          {
            id: "forced-critical-hit",
            label: "Forced critical hit",
            amount: 1,
          },
        ];
      }
      return {
        chance: clamp(chance, 0, 1),
        chanceBeforeCap,
        contributors,
        damage: Math.max(1, Number(damage || 1)),
      };
    },
    strikeMultiplier(
      event: SimulationEvent,
      time: number,
      runtime: Gw2QueryRuntime | null = null,
    ) {
      const relicContext = runtime?.relic ? runtime : historicalRelicContext;
      const relicBonus = relicOutgoingDamageBonus(
        relicContext,
        "strike",
        time,
        event,
      );
      if (event?.independentSummonStrike === true) {
        const base =
          (1 + vulnerabilityStacksAt(time, runtime) / 100) *
          Number(event.summonStrikeMultiplier ?? 1) *
          (1 + relicBonus);
        return event?.summonUsesProfessionModifiers === true
          ? activeProfession.modifyStrikeDamage(
              hookContext(time, { event, runtime }),
              base,
            )
          : base;
      }
      const sigils = activeSigilSetAt(time, runtime);
      const timeOfDayMultiplier =
        config.timeOfDay === "night"
          ? Number(sigils.nightStrikeMultiplier || 1)
          : 1;
      const base =
        (1 + vulnerabilityStacksAt(time, runtime) / 100) *
        (Number(sigils.strike || 1) + relicBonus) *
        timeOfDayMultiplier *
        Number(config.modifiers?.strike || 1);
      return activeProfession.modifyStrikeDamage(
        hookContext(time, {
          event,
          runtime,
          damageAdditiveBonus: relicBonus,
        }),
        base,
      );
    },
    conditionMultiplier(
      name: string,
      time: number,
      event: SimulationEvent | null = null,
      runtime: Gw2QueryRuntime | null = null,
    ) {
      const relicContext = runtime?.relic ? runtime : historicalRelicContext;
      const relicBonus = relicOutgoingDamageBonus(
        relicContext,
        "condition",
        time,
        event,
      );
      const sigils = activeSigilSetAt(time, runtime);
      const base =
        (1 + vulnerabilityStacksAt(time, runtime) / 100) *
        (Number(sigils.condition || 1) + relicBonus) *
        Number(config.modifiers?.condition || 1);
      return activeProfession.modifyConditionDamage(
        hookContext(time, {
          event,
          condition: name,
          runtime,
          damageAdditiveBonus: relicBonus,
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
