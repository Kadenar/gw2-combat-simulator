import type { Gw2BuffAudience, Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';
import { buffApplicationStacks, MIGHT_ATTRIBUTE_BONUS_PER_STACK } from '#gw2/platform/combat/boons.js';
import {
  criticalChance,
  criticalDamageMultiplier,
  gw2ConditionDurationMultiplier
} from '#gw2/platform/combat/formulas.js';
import type { Gw2DamageInputs, Gw2ModifierContext, Gw2ModifierHook } from '#gw2/platform/combat/modifiers.js';
import type { Gw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { gw2EventActorType } from '#gw2/platform/combat/state/event-ownership.js';
import type { Gw2RuntimeStateLike } from '#gw2/platform/combat/state/targets.js';
import {
  canonicalTargetConditionName,
  createPermanentTargetConditionStacks,
  runtimeTargetConditionStacks
} from '#gw2/platform/combat/state/targets.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { NormalizedProfessionContract } from '#gw2/platform/engine/profession/types.js';
import type { CatalogEntity } from '#gw2/platform/engine/skills/types.js';
import { UTILITY_STRIKE_DAMAGE_BONUSES } from '#gw2/platform/equipment/consumables/utilities.js';
import {
  relicConditionDamageBonus,
  relicConditionDurationBonus,
  relicCriticalChanceBonus,
  relicOutgoingDamageBonus
} from '#gw2/platform/equipment/relics/query.js';
import { createRelicTimelineRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import type { Gw2RelicRuntime } from '#gw2/platform/equipment/relics/types.js';
import { gw2SigilSet, sigilCriticalContribution } from '#gw2/platform/equipment/sigils/rules.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { roundEffectDuration } from '#gw2/platform/skills/timing.js';
import { boundedNumber, clamp } from '#kernel/core/numeric.js';

interface TraitCatalog {
  readonly traits?: readonly CatalogEntity[];
}

interface CreateGw2CombatQueryOptions<TProfessionState extends object> {
  readonly profession?: NormalizedProfessionContract<TProfessionState>;
  readonly config?: Gw2Config;
  readonly events?: readonly SimulationEvent[];
  readonly resolvedTimelineEvents?: readonly SimulationEvent[];
  readonly traits?: ReadonlySet<string | number>;
  readonly conditionDurationBonus?: (context: Gw2QueryRuntime | null | undefined, at: number) => number;
}

interface HookContextOptions {
  readonly event?: SimulationEvent | null;
  readonly condition?: string | null;
  readonly runtime?: Gw2QueryRuntime | null;
  readonly damageInputs?: Gw2DamageInputs;
  readonly criticalChanceContributors?: Gw2CriticalChanceContributor[];
  readonly conditionSample?: Gw2ConditionSample;
}

/**
 * Carries both stable ids and names for every selected profession trait.
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

/** Conditions use their owner's bonuses; summon strike profiles and original actor metadata stay intact. */
function conditionOwnerEvent(event: SimulationEvent | null): SimulationEvent | null {
  if (event?.actorType !== 'summon' || event.independentConditionOwner) return event;
  return {
    ...event,
    actorType: 'player',
    ownerActorType: 'player',
    summonKind: undefined,
    summonOwner: undefined,
    independentSummonStrike: false,
    summonInheritsAttributes: true,
    summonIgnoresBoons: false,
    summonUsesEquipmentModifiers: true,
    summonUsesProfessionModifiers: true
  };
}

/**
 * Builds the timestamp-aware combat facts shared by scheduling and resolution.
 * A supplied runtime makes same-timestamp buffs, weapon sets, profession state,
 * conditions, and active equipment effects chronological instead of looking
 * ahead in the completed event stream.
 */
export function createGw2CombatQuery<TProfessionState extends object = object>({
  profession,
  config = {},
  events = [],
  resolvedTimelineEvents,
  traits = selectedGw2TraitValues(config, profession?.catalog),
  conditionDurationBonus
}: CreateGw2CombatQueryOptions<TProfessionState> = {}): Readonly<Gw2CombatQuery> {
  if (!profession?.id) {
    throw new TypeError('GW2 combat query requires a profession.');
  }

  const activeProfession = profession;
  const configuredTargetConditionStacks = createPermanentTargetConditionStacks(config);
  const timeline = createGw2TimelineIndex({
    config,
    events: resolvedTimelineEvents ?? events,
    resolved: resolvedTimelineEvents != null
  });
  const historicalRelicContext = Object.freeze({
    config,
    relic: createRelicTimelineRuntime(config.relic, events)
  });
  // `query` is assigned after `completedQuery` is constructed. Hook handlers
  // that reference `query` are only called during scheduling/resolution (after
  // this function returns), so the null-during-construction window is safe.
  // Default to chronological live relic state, replaying history only when no live relic is supplied.
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
    const calculatedPrimaryWeapon = gw2PrimaryWeapon(config, normalizedWeaponSet) || '';
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
    return buffApplicationStacks(applications, kind, time, maximum, { audience, companionId, ordered: true });
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
   */
  const isBoonIsolatedSummonEvent = (event: SimulationEvent | null | undefined): boolean =>
    gw2EventActorType(event) === 'summon' && event?.summonInheritsAttributes !== true && event?.source !== 'Phantasm';
  const summonCompanionId = (event: SimulationEvent | null | undefined): string | null => {
    if (!event || gw2EventActorType(event) !== 'summon') return null;
    if (event.summonOwner) return String(event.summonOwner);
    return null;
  };

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

  const mightStacksAt = (
    time: number,
    runtime: Gw2QueryRuntime | null | undefined,
    event: SimulationEvent | null | undefined
  ): number => boonStacksAt('might', time, 25, runtime, event);

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
   */
  const vulnerabilityStacksAt = (time: number, runtime: Gw2QueryRuntime | null | undefined): number => {
    const configured = configuredTargetConditionStacks('Vulnerability');
    // Runtime stacks are nonnegative, so an already-capped permanent assumption needs no history scan.
    return configured >= 25
      ? 25
      : clamp(configured + runtimeTargetConditionStacks(runtime, 'Vulnerability', time), 0, 25);
  };

  const targetConditionStacksAt = (condition: string, time: number, runtime: Gw2QueryRuntime | null = null): number => {
    const name = canonicalTargetConditionName(condition);
    if (name === 'Vulnerability') {
      return vulnerabilityStacksAt(time, runtime);
    }

    return configuredTargetConditionStacks(name) + runtimeTargetConditionStacks(runtime, name, time);
  };

  const activeWeaponSetAt = (time: number, runtime: Gw2QueryRuntime | null | undefined): number => {
    const runtimeSet = Number(runtime?.activeWeaponSet);
    return runtimeSet === 1 || runtimeSet === 2 ? runtimeSet : timeline.activeWeaponSetAt(time);
  };

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
      damageInputs,
      conditionSample,
      criticalChanceContributors
    }: HookContextOptions = {}
  ): Gw2ModifierContext => ({
    profession: activeProfession,
    config: activeConfigAt(time, runtime),
    time,
    event,
    skillId: event?.skillId ?? null,
    sourceId: event?.sourceId ?? null,
    actorType: event ? gw2EventActorType(event) : null,
    condition,
    traits,
    query: query ?? undefined,
    timeline,
    events,
    runtime,
    damageInputs,
    conditionSample,
    criticalChanceContributors
  });

  const statsAt = (
    time: number,
    event: SimulationEvent | null = null,
    runtime: Gw2QueryRuntime | null = null
  ): Gw2ResolvedStats => {
    if (event?.type === 'condition') event = conditionOwnerEvent(event);
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
    // Independent summons use their own base stats instead of the player's,
    // including condition duration so food and other owner bonuses cannot leak in.
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
        expertise: Number(event.summonBaseExpertise ?? stats.expertise),
        conditionDurationBonus: 0,
        conditionDurationBonuses: {}
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
      // Preserve the hit's boon fact even when forced critical chance replaces its presentation contributors.
      const furyActive = furyActiveAt(time, runtime, event);
      if (
        event?.independentSummonStrike === true &&
        event?.summonInheritsAttributes !== true &&
        event?.summonInheritsCriticalAttributes !== true
      ) {
        const summonFuryBonus = furyActive ? 0.25 : 0;
        const baseChance = Number(event.summonCriticalChance ?? 0.05) + summonFuryBonus;
        const chance =
          event.summonUsesProfessionModifiers === true
            ? activeProfession.modifyCriticalChance(hookContext(time, { event, runtime }), baseChance)
            : baseChance;
        return {
          furyActive,
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

      if (furyActive) {
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
        furyActive,
        chance: clamp(chance, 0, 1),
        chanceBeforeCap,
        contributors,
        damage: Math.max(1, Number(damage || 1))
      };
    },
    strikeMultiplier(event: SimulationEvent, time: number, runtime: Gw2QueryRuntime | null = null) {
      const relicContext = runtime?.relic ? runtime : historicalRelicContext;
      const relicBonus =
        event.summonUsesEquipmentModifiers === false
          ? 0
          : relicOutgoingDamageBonus(relicContext, 'strike', time, event);
      const modifier = activeProfession.modifyStrikeDamage as Gw2ModifierHook;
      const vulnerability = 1 + vulnerabilityStacksAt(time, runtime) / 100;
      if (event.independentSummonStrike === true) {
        // Independent profiles already apply their eligible relic bonus as a separate factor; only sigil leakage changes.
        const base = vulnerability * Number(event.summonStrikeMultiplier ?? 1) * (1 + relicBonus);
        return event.summonUsesProfessionModifiers === true
          ? modifier(hookContext(time, { event, runtime }), base)
          : base;
      }

      const sigils = activeSigilSetAt(time, runtime);
      const sigilFactor = event.summonUsesEquipmentModifiers === false ? 1 : Number(sigils.strike || 1);
      const sigilBonus =
        event.summonUsesEquipmentModifiers === false
          ? 0
          : Number.isFinite(Number(sigils.strikeAdd))
            ? Number(sigils.strikeAdd)
            : sigilFactor - 1;
      const timeOfDayMultiplier = config.timeOfDay === 'night' ? Number(sigils.nightStrikeMultiplier || 1) : 1;
      const utilityMultiplier = 1 + Number(UTILITY_STRIKE_DAMAGE_BONUSES[config.utility || ''] || 0) / 100;
      // Independent factors retain their established order; only additive equipment enters the shared bucket.
      const equipmentFactor = modifier.acceptsDamageInputs ? 1 : sigilFactor + relicBonus;
      const base =
        vulnerability *
        equipmentFactor *
        timeOfDayMultiplier *
        Number(sigils.strikeMultiplier || 1) *
        utilityMultiplier *
        Number(config.modifiers?.strike || 1);
      return modifier(
        hookContext(time, {
          event,
          runtime,
          damageInputs: { strikeSigilBonus: sigilBonus, equipmentBonus: relicBonus }
        }),
        base
      );
    },
    conditionMultiplier(
      name: string,
      time: number,
      event: SimulationEvent | null = null,
      runtime: Gw2QueryRuntime | null = null,
      sample?: Gw2ConditionSample
    ) {
      event = conditionOwnerEvent(event);
      const relicContext = runtime?.relic ? runtime : historicalRelicContext;
      const usesEquipmentModifiers = event?.summonUsesEquipmentModifiers !== false;
      const relicBonus = usesEquipmentModifiers ? relicOutgoingDamageBonus(relicContext, 'condition', time, event) : 0;
      const sigils = activeSigilSetAt(time, runtime);
      // Ordinary summon conditions use their player's bonuses; independent pet/mech owners never inherit Bursting.
      const usesSigil = usesEquipmentModifiers && !(event?.actorType === 'summon' && event.independentConditionOwner);
      const sigilFactor = usesSigil ? Number(sigils.condition || 1) : 1;
      const sigilBonus = usesSigil
        ? Number.isFinite(Number(sigils.conditionAdd))
          ? Number(sigils.conditionAdd)
          : sigilFactor - 1
        : 0;
      const modifier = activeProfession.modifyConditionDamage as Gw2ModifierHook;
      const base =
        (1 + (sample?.vulnerabilityStacks ?? vulnerabilityStacksAt(time, runtime)) / 100) *
        (modifier.acceptsDamageInputs ? 1 : sigilFactor + relicBonus) *
        Number(config.modifiers?.condition || 1);
      return modifier(
        hookContext(time, {
          event,
          condition: name,
          runtime,
          conditionSample: sample,
          damageInputs: { conditionSigilBonus: sigilBonus, equipmentBonus: relicBonus }
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
      event = conditionOwnerEvent(event);
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
      return boundedNumber(modified || 1, 1, 1, 2);
    },
    conditionBaseDurationMultiplier(
      name: string,
      time: number,
      event: SimulationEvent | null = null,
      runtime: Gw2QueryRuntime | null = null
    ) {
      event = conditionOwnerEvent(event);
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

export interface Gw2QueryRuntime extends Gw2RuntimeStateLike {
  readonly boons?: Map<string, Gw2TimedBuffApplication[]>;
  readonly activeWeaponSet?: number;
  readonly sigil?: { readonly severanceUntil?: number };
  readonly relic?: Gw2RelicRuntime;
  readonly profession?: object | null;
}

export interface Gw2CriticalChanceContributor {
  readonly id: string;
  readonly label: string;
  readonly amount: number;
}

export interface Gw2CriticalResult {
  chance: number;
  damage: number;
  didCrit?: boolean | null;
  readonly chanceBeforeCap?: number;
  readonly furyActive?: boolean;
  readonly contributors?: readonly Gw2CriticalChanceContributor[];
}

/** Facts shared only while one condition-buffer pass observes an unchanged target/runtime state. */
export interface Gw2ConditionSample {
  readonly vulnerabilityStacks: number;
  readonly modifierValues: Map<object, number | null>;
}

export interface Gw2CombatQuery {
  statsAt(time: number, event?: SimulationEvent | null, runtime?: Gw2QueryRuntime | null): Gw2ResolvedStats;
  mightStacksAt(time: number, runtime?: Gw2QueryRuntime | null, event?: SimulationEvent | null): number;
  furyActiveAt(time: number, runtime?: Gw2QueryRuntime | null, event?: SimulationEvent | null): boolean;
  vulnerabilityStacksAt(time: number, runtime?: Gw2QueryRuntime | null): number;
  critical(event: SimulationEvent, time: number, runtime?: Gw2QueryRuntime | null): Gw2CriticalResult;
  strikeMultiplier(event: SimulationEvent, time: number, runtime?: Gw2QueryRuntime | null): number;
  conditionMultiplier(
    name: string,
    time: number,
    event?: SimulationEvent | null,
    runtime?: Gw2QueryRuntime | null,
    sample?: Gw2ConditionSample
  ): number;
  conditionDurationMultiplier(
    name: string,
    time: number,
    stats?: Gw2ResolvedStats,
    event?: SimulationEvent | null,
    runtime?: Gw2QueryRuntime | null
  ): number;
  conditionBaseDurationMultiplier(
    name: string,
    time: number,
    event?: SimulationEvent | null,
    runtime?: Gw2QueryRuntime | null
  ): number;
  targetConditionStacks(condition: string, time: number, runtime?: Gw2QueryRuntime | null): number;
  targetHasCondition(condition: string, time: number, runtime?: Gw2QueryRuntime | null): boolean;
  readonly activeWeaponSetAt: Gw2TimelineIndex['activeWeaponSetAt'];
  readonly activeSigilSetAt: Gw2TimelineIndex['activeSigilSetAt'];
  readonly timedStacks: Gw2TimelineIndex['timedStacks'];
  readonly timeline: Readonly<Gw2TimelineIndex>;
}

/** Keys whose resolved values support numeric attribute adjustments. */
export type Gw2NumericStatKey = {
  [Key in keyof Gw2ResolvedStats]: Gw2ResolvedStats[Key] extends number ? Key : never;
}[keyof Gw2ResolvedStats];

export interface Gw2ResolvedStats {
  readonly power: number;
  readonly precision: number;
  readonly toughness: number;
  readonly vitality: number;
  readonly ferocity: number;
  readonly conditionDamage: number;
  readonly expertise: number;
  readonly concentration: number;
  readonly healingPower: number;
  readonly boonDurationBonus: number;
  readonly boonDurationBonuses: Readonly<Record<string, number>>;
  readonly conditionDurationBonus: number;
  readonly conditionDurationBonuses: Readonly<Record<string, number>>;
}

/** Snapshots natural condition duration at application time; each phase owns its stacks and observation window. */
export function conditionApplicationDuration(
  query: Readonly<Gw2CombatQuery>,
  name: string,
  event: SimulationEvent,
  runtime: Gw2QueryRuntime
): number {
  const stats = query.statsAt(event.at, event, runtime);
  const durationMultiplier = event.fixedDuration
    ? 1
    : query.conditionDurationMultiplier(name, event.at, stats, event, runtime);
  const baseDurationMultiplier = event.fixedDuration
    ? 1
    : (query.conditionBaseDurationMultiplier?.(name, event.at, event, runtime) ?? 1);
  const duration = Math.max(0, Number(event.duration || 0)) * baseDurationMultiplier * durationMultiplier;
  return roundEffectDuration(duration);
}

/** Returns the configured attributes for a one-based weapon set. */
export function gw2StatsForWeaponSet(config: Gw2Config, weaponSet = config.startingWeaponSet): Gw2Stats {
  const index = Number(weaponSet) === 2 ? 1 : 0;
  return {
    ...(config.attributes || {}),
    ...(config.stats || {}),
    ...(config.weaponSetStats?.[index] || {})
  };
}

export function gw2StaticAttributes(
  config: Gw2Config,
  mightStacks: number | boolean | undefined = config.boons?.might,
  weaponSet = config.startingWeaponSet
): Gw2ResolvedStats {
  const mightBonus = MIGHT_ATTRIBUTE_BONUS_PER_STACK * Number(mightStacks || 0);
  const stats = gw2StatsForWeaponSet(config, weaponSet);
  return {
    power: Number(stats.power || 0) + mightBonus,
    precision: Number(stats.precision || 0),
    toughness: Number(stats.toughness || 0),
    vitality: Number(stats.vitality || 0),
    ferocity: Number(stats.ferocity || 0),
    conditionDamage: Number(stats.conditionDamage || 0) + mightBonus,
    expertise: Number(stats.expertise || 0),
    concentration: Number(stats.concentration || 0),
    healingPower: Number(stats.healingPower || 0),
    boonDurationBonus: Number(stats.boonDurationBonus || 0),
    boonDurationBonuses: {
      ...(stats.boonDurationBonuses || {})
    },
    conditionDurationBonus: Number(stats.conditionDurationBonus || 0),
    conditionDurationBonuses: {
      ...(stats.conditionDurationBonuses || {})
    }
  };
}
