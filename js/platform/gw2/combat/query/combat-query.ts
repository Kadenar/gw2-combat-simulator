import {
  buffMatchesAudience,
  durationStackingBoonCapSeconds,
  isDurationStackingBoon,
  remainingDurationStackSeconds,
  sumActiveStacks
} from '../state/boons.js';
import { criticalChance, criticalDamageMultiplier } from '../damage/calculations.js';
import { gw2EventActorType } from '../state/event-ownership.js';
import { clamp } from '../numeric.js';
import { createRelicTimelineRuntime } from '../../equipment/relics/runtime.js';
import {
  relicConditionDamageBonus,
  relicConditionDurationBonus,
  relicCriticalChanceBonus,
  relicOutgoingDamageBonus
} from '../../equipment/relics/query.js';
import {
  gw2ConditionDurationMultiplier,
  gw2SigilSet,
  gw2StatsForWeaponSet,
  gw2StaticAttributes,
  MIGHT_ATTRIBUTE_BONUS_PER_STACK
} from './runtime-rules.js';
import { sigilCriticalContribution } from '../../equipment/sigils/rules.js';
import {
  canonicalTargetConditionName,
  createPermanentTargetConditionStacks,
  runtimeTargetConditionStacks
} from '../state/targets.js';
import { createGw2TimelineIndex } from './timeline-index.js';

import type {
  CatalogEntity,
  NormalizedProfessionContract,
  SchedulerRecord,
  SimulationEvent
} from '../../../engine/types.js';
import type { Gw2BuffAudience } from '../state/types.js';
import type { Gw2CombatQuery, Gw2CriticalChanceContributor, Gw2QueryRuntime, Gw2ResolvedStats } from './types.js';
import type { Gw2Config } from '../../simulation/config.js';
import type { Gw2ResolverExtensions } from '../../resolver/types.js';

interface TraitCatalog {
  readonly traits?: readonly CatalogEntity[];
}

interface CreateGw2CombatQueryOptions<TProfessionState extends object> {
  readonly profession?: NormalizedProfessionContract<TProfessionState>;
  readonly config?: Gw2Config;
  readonly events?: readonly SimulationEvent[];
  readonly traits?: ReadonlySet<string | number>;
  readonly conditionDurationBonus?: Gw2ResolverExtensions['conditionDurationBonus'];
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
// Expands canonical trait IDs to both ID and name forms so existing internal
// consumers can migrate independently without duplicating catalog lookups.
export function selectedGw2TraitValues(config: Gw2Config = {}, catalog: TraitCatalog = {}): Set<string | number> {
  const values = new Set<string | number>(Array.isArray(config.selectedTraitIds) ? config.selectedTraitIds : []);
  const byId = new Map<number, CatalogEntity>();
  for (const trait of catalog?.traits || []) {
    byId.set(Number(trait.id), trait);
  }

  for (const value of [...values]) {
    const trait = byId.get(Number(value));
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
export function createGw2CombatQuery<TProfessionState extends object = SchedulerRecord>({
  profession,
  config = {},
  events = [],
  traits = selectedGw2TraitValues(config, profession?.catalog),
  conditionDurationBonus
}: CreateGw2CombatQueryOptions<TProfessionState> = {}): Readonly<Gw2CombatQuery> {
  if (!profession?.id) {
    throw new TypeError('GW2 combat query requires a profession.');
  }

  const activeProfession = profession;
  const configuredTargetConditionStacks = createPermanentTargetConditionStacks(config);
  const timeline = createGw2TimelineIndex({ config, events });
  const historicalRelicContext = Object.freeze({
    relic: createRelicTimelineRuntime(config.relic, events)
  });
  // `query` is assigned after `completedQuery` is constructed. Hook handlers
  // that reference `query` are only called during scheduling/resolution (after
  // this function returns), so the null-during-construction window is safe.
  // Keep the exported standalone query backward compatible. Production
  // resolver composition supplies this capability explicitly.
  const equipmentConditionDurationBonus =
    conditionDurationBonus ||
    ((runtime: Gw2QueryRuntime | null | undefined, at: number): number =>
      relicConditionDurationBonus(runtime?.relic ? runtime : historicalRelicContext, at));
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
        healingPower: stats.healingPower ?? 0
      }
    };
  };

  const startingWeaponSet = Number(config.startingWeaponSet) === 2 ? 2 : 1;
  const staticConfig = configWithBaselineStats(startingWeaponSet);
  const activeConfigsByWeaponSet = new Map<number, Gw2Config>();
  const staticAttributesByWeaponSet = new Map<number, Gw2ResolvedStats>();
  /** Reuses immutable weapon-set inputs while returning fresh mutable attribute results to profession hooks. */
  const staticAttributesAt = (weaponSet: number, mightStacks: number): Gw2ResolvedStats => {
    const normalizedWeaponSet = weaponSet === 2 ? 2 : 1;
    let base = staticAttributesByWeaponSet.get(normalizedWeaponSet);
    if (!base) {
      base = gw2StaticAttributes(activeConfigForWeaponSet(normalizedWeaponSet), 0, normalizedWeaponSet);
      staticAttributesByWeaponSet.set(normalizedWeaponSet, base);
    }

    const mightBonus = MIGHT_ATTRIBUTE_BONUS_PER_STACK * Number(mightStacks || 0);
    return {
      ...base,
      power: Number(base.power || 0) + mightBonus,
      conditionDamage: Number(base.conditionDamage || 0) + mightBonus,
      conditionDurationBonuses: { ...(base.conditionDurationBonuses || {}) }
    };
  };

  /** Builds each weapon-set-specific hook configuration once per combat query. */
  function activeConfigForWeaponSet(weaponSet: number): Gw2Config {
    if (!config.weaponSetStats?.length) return staticConfig;
    const normalizedWeaponSet = weaponSet === 2 ? 2 : 1;
    const cached = activeConfigsByWeaponSet.get(normalizedWeaponSet);
    if (cached) return cached;
    const activeConfig = configWithBaselineStats(normalizedWeaponSet);
    const calculatedPrimaryWeapon = (normalizedWeaponSet === 2 ? config.weaponSet2Primary : config.primaryWeapon) || '';
    const resolved = {
      ...activeConfig,
      attributeProvenance: {
        ...(config.attributeProvenance || {}),
        calculatedWeaponSet: normalizedWeaponSet,
        calculatedPrimaryWeapon
      }
    };
    activeConfigsByWeaponSet.set(normalizedWeaponSet, resolved);
    return resolved;
  }

  let query: Readonly<Gw2CombatQuery> | null = null;

  /**
   * @param {Gw2QueryRuntime | null | undefined} runtime
   * @param {string} kind
   * @param {number} time
   * @param {number} maximum
   * @param {Gw2BuffAudience} [audience]
   */
  // Returns null (not 0) when no runtime is present — null signals the caller
  // to fall back to the scheduled timeline rather than overriding with zero.
  const runtimeBuffStacks = (
    runtime: Gw2QueryRuntime | null | undefined,
    kind: string,
    time: number,
    maximum: number,
    audience: Gw2BuffAudience = 'all',
    companionId: string | null = null
  ): number | null => {
    if (!runtime) return null;
    const applications = runtime.boons?.get(kind) || [];
    if (isDurationStackingBoon(kind)) {
      const remaining = remainingDurationStackSeconds(applications, time, {
        includes: (application) => buffMatchesAudience(application, audience, companionId),
        maximum: durationStackingBoonCapSeconds(kind)
      });
      return remaining > 0 ? Math.min(1, Math.max(0, maximum)) : 0;
    }

    return sumActiveStacks(
      // Scheduler and resolver runtimes append applications in
      // chronological event-queue order. The stop predicate depends on that
      // ordering so future applications can terminate the scan.
      applications,
      (application) =>
        buffMatchesAudience(application, audience, companionId) &&
        application.at <= time &&
        application.expiresAt > time,
      (application) => Number(application.stacks || 1),
      maximum,
      (application) => application.at > time
    );
  };

  /** Uses chronological runtime state when present, otherwise scheduled state. */
  const dynamicBoonStacksAt = (
    kind: string,
    time: number,
    maximum: number,
    runtime: Gw2QueryRuntime | null | undefined,
    audience: Gw2BuffAudience = 'all',
    fallbackDuration = 0,
    companionId: string | null = null
  ): number =>
    runtimeBuffStacks(runtime, kind, time, maximum, audience, companionId) ??
    timeline.buffStacksAt(kind, time, fallbackDuration, maximum, audience, companionId);
  /**
   * Player-configured permanent boons do not apply to ordinary summons.
   * Explicitly inherited companion profiles retain their existing behavior.
   *
   * @param {SimulationEvent | null | undefined} event
   */
  const isBoonIsolatedSummonEvent = (event: SimulationEvent | null | undefined): boolean =>
    gw2EventActorType(event) === 'summon' && event?.summonInheritsAttributes !== true && event?.source !== 'Phantasm';
  const summonCompanionId = (event: SimulationEvent | null | undefined): string | null => {
    if (!event || gw2EventActorType(event) !== 'summon') return null;
    if (event.summonOwner) return String(event.summonOwner);
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
    event: SimulationEvent | null | undefined
  ): number => {
    const isolatedSummon = isBoonIsolatedSummonEvent(event);
    // Isolated summons don't inherit the player's configured permanent boons —
    // they only receive boons explicitly targeted at summons via the runtime.
    const configured = isolatedSummon ? 0 : Number(config.boons?.[kind] || 0);
    if (isolatedSummon) {
      return dynamicBoonStacksAt(kind, time, maximum, runtime, 'summon', 0, summonCompanionId(event));
    }

    const dynamic = dynamicBoonStacksAt(kind, time, maximum, runtime, 'all', 1);
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
    event: SimulationEvent | null | undefined
  ): number => boonStacksAt('might', time, 25, runtime, event);
  /**
   * @param {number} time
   * @param {Gw2QueryRuntime | null | undefined} runtime
   * @param {SimulationEvent | null | undefined} event
   */
  const furyActiveAt = (
    time: number,
    runtime: Gw2QueryRuntime | null | undefined,
    event: SimulationEvent | null | undefined
  ): boolean => {
    if (event?.summonIgnoresBoons === true) return false;
    const isolatedSummon = isBoonIsolatedSummonEvent(event);
    const inheritsOwnerCriticalState =
      event?.summonInheritsAttributes === true || event?.summonInheritsCriticalAttributes === true;
    // Illusions inherit the summoner's base crit chance but never the
    // player-configured permanent Fury. They gain Fury only when a skill
    // applies it dynamically (handled by the runtime/timeline branch below).
    const illusionEvent = event?.source === 'Clone' || event?.source === 'Phantasm';
    if ((!isolatedSummon || inheritsOwnerCriticalState) && !illusionEvent && config.boons?.fury) {
      return true;
    }

    if (illusionEvent || (isolatedSummon && !inheritsOwnerCriticalState)) {
      return dynamicBoonStacksAt('fury', time, 1, runtime, 'summon', 0, summonCompanionId(event)) > 0;
    }

    return dynamicBoonStacksAt('fury', time, 1, runtime) > 0;
  };

  /**
   * Independent summons consume only explicitly summon-targeted applications.
   */
  const summonMightStacksAt = (
    time: number,
    runtime: Gw2QueryRuntime | null | undefined,
    event: SimulationEvent | null | undefined
  ): number => {
    if (event?.summonIgnoresBoons === true) return 0;
    return dynamicBoonStacksAt('might', time, 25, runtime, 'summon', 0, summonCompanionId(event));
  };

  /**
   * Reads Vulnerability only from target-condition state so it follows condition stacking and expiry rules.
   *
   * @param {number} time
   * @param {Gw2QueryRuntime | null | undefined} runtime
   */
  const vulnerabilityStacksAt = (time: number, runtime: Gw2QueryRuntime | null | undefined): number =>
    clamp(
      configuredTargetConditionStacks('Vulnerability') + runtimeTargetConditionStacks(runtime, 'Vulnerability', time),
      0,
      25
    );
  /**
   * @param {string} condition
   * @param {number} time
   * @param {Gw2QueryRuntime | null} [runtime]
   */
  const targetConditionStacksAt = (condition: string, time: number, runtime: Gw2QueryRuntime | null = null): number => {
    const name = canonicalTargetConditionName(condition);
    if (name === 'Vulnerability') {
      return vulnerabilityStacksAt(time, runtime);
    }

    return configuredTargetConditionStacks(name) + runtimeTargetConditionStacks(runtime, name, time);
  };

  /**
   * @param {number} time
   * @param {Gw2QueryRuntime | null | undefined} runtime
   */
  const activeWeaponSetAt = (time: number, runtime: Gw2QueryRuntime | null | undefined): number => {
    const runtimeSet = Number(runtime?.activeWeaponSet);
    return runtimeSet === 1 || runtimeSet === 2 ? runtimeSet : timeline.activeWeaponSetAt(time);
  };

  /**
   * @param {number} time
   * @param {Gw2QueryRuntime | null | undefined} runtime
   */
  const activeSigilSetAt = (time: number, runtime: Gw2QueryRuntime | null | undefined) =>
    gw2SigilSet(config, activeWeaponSetAt(time, runtime));
  const activeConfigAt = (time: number, runtime: Gw2QueryRuntime | null | undefined): Gw2Config => {
    return activeConfigForWeaponSet(activeWeaponSetAt(time, runtime));
  };

  const hookContext = (
    time: number,
    {
      event = null,
      condition = null,
      runtime = null,
      damageAdditiveBonus = 0,
      criticalChanceContributors
    }: HookContextOptions = {}
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
    criticalChanceContributors
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
    runtime: Gw2QueryRuntime | null = null
  ): Gw2ResolvedStats => {
    const activeWeaponSet = activeWeaponSetAt(time, runtime);
    const modifiedStats = activeProfession.modifyAttributes(
      hookContext(time, { event, runtime }),
      staticAttributesAt(activeWeaponSet, mightStacksAt(time, runtime, event))
    ) as unknown as Gw2ResolvedStats;
    // Time-varying relic Condition Damage (e.g. Relic of Thorns +30/stack) folds
    // into the sampled attribute so every downstream condition tick scales with it.
    const relicConditionDamage = relicConditionDamageBonus(runtime?.relic ? runtime : historicalRelicContext, time);
    const stats =
      relicConditionDamage > 0
        ? { ...modifiedStats, conditionDamage: Number(modifiedStats.conditionDamage ?? 0) + relicConditionDamage }
        : modifiedStats;
    // Independent summons use their own base stats instead of the player's.
    // summonInheritsCriticalAttributes=true lets them share precision/ferocity
    // (e.g., for illusions that scale with the player's crit chance).
    if (
      event?.independentSummonStrike === true &&
      event?.summonInheritsAttributes !== true &&
      Number.isFinite(Number(event.summonBasePower))
    ) {
      const inheritCriticalAttributes = event.summonInheritsCriticalAttributes === true;
      // Fixed-damage summon skills can still receive Fury while opting out of Might's attribute scaling.
      const summonMightStacks = event.summonUsesMight === false ? 0 : summonMightStacksAt(time, runtime, event);
      return {
        ...stats,
        power: Number(event.summonBasePower) + summonMightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK,
        precision: inheritCriticalAttributes ? stats.precision : Number(event.summonBasePrecision ?? 1000),
        ferocity: inheritCriticalAttributes ? stats.ferocity : Number(event.summonBaseFerocity ?? 0),
        conditionDamage:
          Number(event.summonBaseConditionDamage ?? stats.conditionDamage) +
          summonMightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK,
        expertise: Number(event.summonBaseExpertise ?? stats.expertise)
      };
    }

    return stats;
  };

  const completedQuery: Readonly<Gw2CombatQuery> = Object.freeze({
    statsAt,
    mightStacksAt,
    furyActiveAt,
    vulnerabilityStacksAt,
    critical(event: SimulationEvent, time: number, runtime: Gw2QueryRuntime | null = null) {
      if (
        event?.independentSummonStrike === true &&
        event?.summonInheritsAttributes !== true &&
        event?.summonInheritsCriticalAttributes !== true
      ) {
        const summonFuryBonus = furyActiveAt(time, runtime, event) ? 0.25 : 0;
        const baseChance = Number(event.summonCriticalChance ?? 0.05) + summonFuryBonus;
        const chance =
          event.summonUsesProfessionModifiers === true
            ? activeProfession.modifyCriticalChance(hookContext(time, { event, runtime }), baseChance)
            : baseChance;
        return {
          chance: event.canCrit === false || event.noCrit ? 0 : clamp(chance, 0, 1),
          damage: Math.max(1, Number(event.summonCriticalDamage ?? 1.5))
        };
      }

      const stats = statsAt(time, event, runtime);
      let contributors: Gw2CriticalChanceContributor[] = [];
      const addContributor = (id: string, label: string, amount: number) => {
        if (Math.abs(amount) <= Number.EPSILON) return;
        contributors.push({ id, label, amount });
      };

      let chance = criticalChance(stats.precision);
      addContributor('precision', 'Precision', chance);
      // Illusions inherit only the summoner's base (precision-derived) crit
      // chance. Player-only gear bonuses — configured crit-chance and weapon
      // sigils — do not carry over to them.
      const illusionEvent = event?.source === 'Clone' || event?.source === 'Phantasm';
      if (!illusionEvent) {
        const configuredBonus = Number(activeConfigAt(time, runtime).stats?.criticalChanceBonus || 0) / 100;
        chance += configuredBonus;
        addContributor('configured-bonus', 'Configured bonus', configuredBonus);
        const sigilBonus = Number(activeSigilSetAt(time, runtime).criticalChanceBonus || 0) / 100;
        chance += sigilBonus;
        addContributor('active-sigils', 'Active weapon sigils', sigilBonus);
      }

      if (furyActiveAt(time, runtime, event)) {
        chance += 0.25;
        addContributor('fury', 'Fury', 0.25);
      }

      const professionContributors: Gw2CriticalChanceContributor[] = [];
      const beforeProfession = chance;
      chance = activeProfession.modifyCriticalChance(
        hookContext(time, {
          event,
          runtime,
          criticalChanceContributors: professionContributors
        }),
        chance
      );
      const tracedProfessionAmount = professionContributors.reduce((sum, contributor) => sum + contributor.amount, 0);
      contributors.push(...professionContributors);
      addContributor(
        'profession-effects',
        'Other profession effects',
        chance - beforeProfession - tracedProfessionAmount
      );
      const relicBonus = relicCriticalChanceBonus(
        runtime?.relic ? runtime : historicalRelicContext,
        event,
        mightStacksAt(time, runtime, event)
      );
      chance += relicBonus;
      addContributor('relic', 'Relic', relicBonus);
      let damage = criticalDamageMultiplier(stats.ferocity);
      damage = activeProfession.modifyCriticalDamage(hookContext(time, { event, runtime }), damage);
      const sigilCritical = sigilCriticalContribution(runtime, time);
      chance += sigilCritical.chance;
      contributors.push(...sigilCritical.chanceContributors);
      damage += sigilCritical.damage;
      let chanceBeforeCap = chance;
      if (event.canCrit === false || event.noCrit) chance = 0;
      // forceCrit (e.g. Wild Blow) overrides everything including canCrit=false.
      if (event.forceCrit) {
        chance = 1;
        chanceBeforeCap = 1;
        contributors = [
          {
            id: 'forced-critical-hit',
            label: 'Forced critical hit',
            amount: 1
          }
        ];
      }

      return {
        chance: clamp(chance, 0, 1),
        chanceBeforeCap,
        contributors,
        damage: Math.max(1, Number(damage || 1))
      };
    },
    strikeMultiplier(event: SimulationEvent, time: number, runtime: Gw2QueryRuntime | null = null) {
      const relicContext = runtime?.relic ? runtime : historicalRelicContext;
      const relicBonus =
        event?.summonUsesEquipmentModifiers === false
          ? 0
          : relicOutgoingDamageBonus(relicContext, 'strike', time, event);
      if (event?.independentSummonStrike === true) {
        const base =
          (1 + vulnerabilityStacksAt(time, runtime) / 100) *
          Number(event.summonStrikeMultiplier ?? 1) *
          (1 + relicBonus);
        return event?.summonUsesProfessionModifiers === true
          ? activeProfession.modifyStrikeDamage(hookContext(time, { event, runtime }), base)
          : base;
      }

      const sigils = activeSigilSetAt(time, runtime);
      const timeOfDayMultiplier = config.timeOfDay === 'night' ? Number(sigils.nightStrikeMultiplier || 1) : 1;
      const base =
        (1 + vulnerabilityStacksAt(time, runtime) / 100) *
        (Number(sigils.strike || 1) + relicBonus) *
        timeOfDayMultiplier *
        Number(config.modifiers?.strike || 1);
      return activeProfession.modifyStrikeDamage(
        hookContext(time, {
          event,
          runtime,
          damageAdditiveBonus: relicBonus
        }),
        base
      );
    },
    conditionMultiplier(
      name: string,
      time: number,
      event: SimulationEvent | null = null,
      runtime: Gw2QueryRuntime | null = null
    ) {
      const relicContext = runtime?.relic ? runtime : historicalRelicContext;
      const usesEquipmentModifiers = event?.summonUsesEquipmentModifiers !== false;
      const relicBonus = usesEquipmentModifiers ? relicOutgoingDamageBonus(relicContext, 'condition', time, event) : 0;
      const sigils = activeSigilSetAt(time, runtime);
      const base =
        (1 + vulnerabilityStacksAt(time, runtime) / 100) *
        (usesEquipmentModifiers ? Number(sigils.condition || 1) + relicBonus : 1) *
        Number(config.modifiers?.condition || 1);
      return activeProfession.modifyConditionDamage(
        hookContext(time, {
          event,
          condition: name,
          runtime,
          damageAdditiveBonus: relicBonus
        }),
        base
      );
    },
    conditionDurationMultiplier(
      name: string,
      time: number,
      stats: Gw2ResolvedStats = statsAt(time),
      event: SimulationEvent | null = null,
      runtime: Gw2QueryRuntime | null = null
    ) {
      const sigils = activeSigilSetAt(time, runtime);
      const usesEquipmentModifiers = event?.summonUsesEquipmentModifiers !== false;
      const sigilBonus = usesEquipmentModifiers
        ? (Number(sigils.conditionDurationBonus || 0) + Number(sigils.conditionDurationBonuses?.[name] || 0)) / 100
        : 0;
      const relicBonus = usesEquipmentModifiers ? equipmentConditionDurationBonus(runtime, time) : 0;
      const base = gw2ConditionDurationMultiplier(name, stats, sigilBonus + relicBonus);
      const modified = activeProfession.modifyConditionDuration(
        hookContext(time, {
          event,
          condition: name,
          runtime
        }),
        base
      );
      // Clamped to [1, 2]: condition duration never drops below baseline and
      // cannot exceed +100% regardless of how many sources stack.
      return clamp(Number(modified || 1), 1, 2);
    },
    conditionBaseDurationMultiplier(
      name: string,
      time: number,
      event: SimulationEvent | null = null,
      runtime: Gw2QueryRuntime | null = null
    ) {
      return Math.max(
        0,
        Number(
          activeProfession.modifyConditionBaseDuration(
            hookContext(time, {
              event,
              condition: name,
              runtime
            }),
            1
          ) || 0
        )
      );
    },
    targetConditionStacks: targetConditionStacksAt,
    targetHasCondition(condition: string, time: number, runtime: Gw2QueryRuntime | null = null) {
      return targetConditionStacksAt(condition, time, runtime) > 0;
    },
    activeWeaponSetAt: timeline.activeWeaponSetAt,
    activeSigilSetAt: timeline.activeSigilSetAt,
    timedStacks: timeline.timedStacks,
    timeline
  });
  query = completedQuery;
  return completedQuery;
}
