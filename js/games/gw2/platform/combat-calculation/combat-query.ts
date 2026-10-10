import { normalizeSelectedTraitIds } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2TimelineIndex } from '#gw2/platform/combat-calculation/timeline-index.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat-calculation/timeline-index.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';
import { MIGHT_ATTRIBUTE_BONUS_PER_STACK } from '#gw2/platform/combat/boons.js';
import {
  criticalChance,
  criticalDamageMultiplier,
  gw2ConditionDurationMultiplier
} from '#gw2/platform/combat/formulas.js';
import type {
  Gw2DamageInputs,
  Gw2ModifierContext,
  Gw2ModifierContribution,
  Gw2ModifierHook
} from '#gw2/platform/combat/modifiers.js';
import { appliedEffectStacks } from '#gw2/platform/combat/query/effect-stacks.js';
import { gw2EventActorType } from '#gw2/platform/combat/state/event-ownership.js';
import type { Gw2RuntimeStateLike } from '#gw2/platform/combat/state/targets.js';
import {
  createPermanentTargetConditionStacks,
  targetConditionStacks,
  targetHasCondition
} from '#gw2/platform/combat/state/targets.js';
import { gw2StaticAttributes, type Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';
import { roundEffectDuration } from '#gw2/platform/effects/timing.js';
import { UTILITY_STRIKE_DAMAGE_BONUSES } from '#gw2/platform/equipment/consumables/utilities.js';
import {
  relicConditionDamageBonus,
  relicConditionDurationBonus,
  relicCriticalChanceBonus,
  relicOutgoingDamageBonus
} from '#gw2/platform/equipment/relics/query.js';
import { createRelicTimelineRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import type { Gw2RelicRuntime } from '#gw2/platform/equipment/relics/types.js';
import { gw2SigilSet } from '#gw2/platform/equipment/sigils/loadout.js';
import { severanceCriticalContribution } from '#gw2/platform/equipment/sigils/severance.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { NormalizedProfessionContract } from '#gw2/platform/profession-definition/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { boundedNumber, clamp } from '#kernel/core/numeric.js';

/** Queries need immutable catalog and formula hooks, not either execution engine's state factories. */
export type Gw2QueryProfession = Pick<
  NormalizedProfessionContract,
  | 'id'
  | 'catalog'
  | 'modifyAttributes'
  | 'modifyConditionAttributes'
  | 'modifyCriticalChance'
  | 'modifyCriticalDamage'
  | 'modifyStrikeDamage'
  | 'modifyConditionDamage'
  | 'modifyConditionDuration'
  | 'modifyConditionBaseDuration'
> & {
  /** Selected modules own player Alacrity strength; all cooldown queries use this same rate. */
  readonly playerAlacrityRechargeRate?: number;
};

interface CreateGw2CombatQueryOptions {
  readonly profession?: Gw2QueryProfession;
  /** Queries that inspect skill readiness require live cooldown state or an explicit preview policy. */
  readonly skillOnCooldown?: (skillId: import('#gw2/platform/skills/types.js').SkillId, time: number) => boolean;
  readonly config?: Gw2Config;
  readonly events?: readonly SimulationEvent[];
  readonly resolvedTimelineEvents?: readonly SimulationEvent[];
  readonly traits?: ReadonlySet<string | number>;
  /** Isolated stat previews may vary health; simulation configs cannot supply this query-only input. */
  readonly attributePreviewPlayerHealthFraction?: number;
}

interface HookContextOptions {
  readonly event?: SimulationEvent | null;
  readonly condition?: string | null;
  readonly runtime?: Gw2QueryRuntime | null;
  readonly damageInputs?: Gw2DamageInputs;
  readonly criticalChanceContributors?: Gw2CriticalChanceContributor[];
  readonly damageContributors?: Gw2ModifierContribution[];
  readonly durationContributors?: Gw2ModifierContribution[];
  readonly conditionSample?: Gw2ConditionSample;
}

/** Records a query-owned multiplier; neutral factors are omitted so previews list only active effects. */
function traceFactor(contributors: Gw2ModifierContribution[], id: string, label: string, value: number): void {
  if (Number.isFinite(value) && Math.abs(value - 1) > 1e-12)
    contributors.push({ id, label, bucket: 'multiplier', value });
}

/** Records a query-owned additive bonus; zero bonuses are omitted. */
function traceBonus(contributors: Gw2ModifierContribution[], id: string, label: string, value: number): void {
  if (Number.isFinite(value) && Math.abs(value) > 1e-12) contributors.push({ id, label, bucket: 'additive', value });
}

/**
 * Keeps a traced list faithful to the returned multiplier: (1 + Σ additive) × Π multipliers must equal the total, so
 * any effect a hook applied without tracing (for example an imperative profession hook) appears as one remainder.
 */
function closeContributions(contributors: Gw2ModifierContribution[], total: number): void {
  let additive = 0;
  let multiplier = 1;
  for (const contribution of contributors) {
    if (contribution.bucket === 'additive') additive += contribution.value;
    else multiplier *= contribution.value;
  }

  const product = (1 + additive) * multiplier;
  if (product > 0) traceFactor(contributors, 'other', 'Other effects', total / product);
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
 * Combines combat primitives, equipment rules, and profession hooks into
 * timestamp-aware combat values shared by simulation and attribute previews.
 * A supplied runtime makes same-timestamp buffs, weapon sets, profession state,
 * conditions, and active equipment effects chronological instead of looking
 * ahead in the completed event stream.
 */
export function createGw2CombatQuery({
  profession,
  config = {},
  skillOnCooldown,
  events = [],
  resolvedTimelineEvents,
  traits = normalizeSelectedTraitIds(config.selectedTraitIds),
  attributePreviewPlayerHealthFraction
}: CreateGw2CombatQueryOptions = {}): Readonly<Gw2CombatQuery> {
  if (!profession?.id) {
    throw new TypeError('GW2 combat query requires a profession.');
  }

  const activeProfession = profession;
  const configuredTargetConditionStacks = createPermanentTargetConditionStacks(config);
  const timeline = createGw2TimelineIndex({
    config,
    playerAlacrityRechargeRate: profession.playerAlacrityRechargeRate,
    skillOnCooldown,
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
  // Live relic state owns earned activations; detached queries retain only the selected relic's base context.
  const equipmentConditionDurationBonus = (runtime: Gw2QueryRuntime | null | undefined, at: number): number =>
    relicConditionDurationBonus(runtime?.relic ? runtime : historicalRelicContext, at);

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

    const mightBonus = MIGHT_ATTRIBUTE_BONUS_PER_STACK * (mightStacks || 0);
    return {
      ...base,
      power: (base.power || 0) + mightBonus,
      conditionDamage: (base.conditionDamage || 0) + mightBonus,
      conditionDurationBonuses: { ...base.conditionDurationBonuses }
    };
  };

  /** Builds each weapon-set-specific hook configuration once per combat query. */
  function activeConfigForWeaponSet(weaponSet: number): Gw2Config {
    const normalizedWeaponSet = weaponSet === 2 ? 2 : 1;
    const cached = activeConfigsByWeaponSet.get(normalizedWeaponSet);
    if (cached) return cached;
    const resolved = { ...config, startingWeaponSet: normalizedWeaponSet };
    activeConfigsByWeaponSet.set(normalizedWeaponSet, resolved);
    return resolved;
  }

  let query: Readonly<Gw2CombatQuery> | null = null;

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
      return appliedEffectStacks({ runtime, timeline, time }, kind, maximum, {
        actor: 'companion',
        companionId: summonCompanionId(event)
      });
    }

    // Nonnegative dynamic grants cannot change an already-capped permanent assumption.
    if (configured >= maximum) return maximum;
    const dynamic = appliedEffectStacks({ runtime, timeline, time }, kind, maximum, { actor: 'player' }, 1);
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
      return (
        appliedEffectStacks({ runtime, timeline, time }, 'fury', 1, {
          actor: 'companion',
          companionId: summonCompanionId(event)
        }) > 0
      );
    }

    return appliedEffectStacks({ runtime, timeline, time }, 'fury', 1) > 0;
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
    return appliedEffectStacks({ runtime, timeline, time }, 'might', 25, {
      actor: 'companion',
      companionId: summonCompanionId(event)
    });
  };

  // Reuse normalized assumptions while the canonical target owner caps their combined live intensity.
  const targetConditionStacksAt = (condition: string, time: number, runtime: Gw2QueryRuntime | null = null): number =>
    targetConditionStacks(config, condition, time, runtime, configuredTargetConditionStacks(condition));

  const vulnerabilityStacksAt = (time: number, runtime: Gw2QueryRuntime | null | undefined): number =>
    targetConditionStacksAt('Vulnerability', time, runtime);

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
      criticalChanceContributors,
      damageContributors,
      durationContributors
    }: HookContextOptions = {}
  ): Gw2ModifierContext => ({
    profession: activeProfession,
    config: activeConfigAt(time, runtime),
    attributePreviewPlayerHealthFraction,
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
    criticalChanceContributors,
    damageContributors,
    durationContributors
  });

  const statsAt = (
    time: number,
    event: SimulationEvent | null = null,
    runtime: Gw2QueryRuntime | null = null
  ): Gw2ResolvedStats => {
    if (event?.type === 'condition') event = conditionOwnerEvent(event);
    const activeWeaponSet = activeWeaponSetAt(time, runtime);
    const context = hookContext(time, { event, runtime });
    const modifiedStats = activeProfession.modifyAttributes(
      context,
      staticAttributesAt(activeWeaponSet, mightStacksAt(time, runtime, event))
    ) as unknown as Gw2ResolvedStats;
    // Time-varying relic Condition Damage (e.g. Relic of Thorns +30/stack) folds
    // into the sampled attribute so every downstream condition tick scales with it.
    const relicConditionDamage = relicConditionDamageBonus(runtime?.relic ? runtime : historicalRelicContext, time);
    let stats =
      relicConditionDamage > 0
        ? { ...modifiedStats, conditionDamage: modifiedStats.conditionDamage + relicConditionDamage }
        : modifiedStats;
    // Independent summons use their own base stats instead of the player's,
    // including condition duration so food and other owner bonuses cannot leak in.
    // summonInheritsCriticalAttributes=true lets them share precision/ferocity
    // (e.g., for illusions that scale with the player's crit chance).
    if (
      event?.independentSummonStrike === true &&
      event.summonInheritsAttributes !== true &&
      Number.isFinite(Number(event.summonBasePower))
    ) {
      const inheritCriticalAttributes = event.summonInheritsCriticalAttributes === true;
      // Fixed-damage summon skills can still receive Fury while opting out of Might's attribute scaling.
      const summonMightStacks = event.summonUsesMight === false ? 0 : summonMightStacksAt(time, runtime, event);
      stats = {
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

    // Apply replacements once, after specialization bonuses, relics, and owner-specific stat profiles.
    return event?.type === 'condition'
      ? (activeProfession.modifyConditionAttributes(context, stats) as Gw2ResolvedStats)
      : stats;
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
        event.independentSummonStrike === true &&
        event.summonInheritsAttributes !== true &&
        event.summonInheritsCriticalAttributes !== true
      ) {
        const summonFuryBonus = furyActive ? 0.25 : 0;
        const professionBonus =
          event.summonUsesProfessionModifiers === true
            ? (statsAt(time, event, runtime).professionCriticalChanceBonus ?? 0) / 100
            : 0;
        const baseChance = Number(event.summonCriticalChance ?? 0.05) + summonFuryBonus + professionBonus;
        const chance =
          event.summonUsesProfessionModifiers === true
            ? activeProfession.modifyCriticalChance(hookContext(time, { event, runtime }), baseChance)
            : baseChance;
        return {
          furyActive,
          chance: event.canCrit === false ? 0 : clamp(chance, 0, 1),
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
      const professionAttributeBonus = (stats.professionCriticalChanceBonus ?? 0) / 100;
      addContributor('precision', 'Precision', chance);
      // Illusions inherit only the summoner's base (precision-derived) crit
      // chance. Player-only gear bonuses — configured crit-chance and weapon
      // sigils — do not carry over to them.
      const illusionEvent = event.source === 'Clone' || event.source === 'Phantasm';
      if (!illusionEvent) {
        const configuredBonus = (stats.criticalChanceBonus || 0) / 100;
        chance += configuredBonus;
        addContributor('configured-bonus', 'Configured bonus', configuredBonus);
        const sigilBonus = (activeSigilSetAt(time, runtime).criticalChanceBonus || 0) / 100;
        chance += sigilBonus;
        addContributor('active-sigils', 'Active weapon sigils', sigilBonus);
      }

      chance += professionAttributeBonus;
      addContributor('profession-attributes', 'Profession attributes', professionAttributeBonus);
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
      const severanceCritical = severanceCriticalContribution(runtime, time);
      chance += severanceCritical.chance;
      contributors.push(...severanceCritical.chanceContributors);
      damage += severanceCritical.damage;
      let chanceBeforeCap = chance;
      if (event.canCrit === false) chance = 0;
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
        damage: Math.max(1, damage || 1)
      };
    },
    strikeMultiplier(
      event: SimulationEvent,
      time: number,
      runtime: Gw2QueryRuntime | null = null,
      contributors?: Gw2ModifierContribution[]
    ) {
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
        const total =
          event.summonUsesProfessionModifiers === true
            ? modifier(hookContext(time, { event, runtime, damageContributors: contributors }), base)
            : base;
        if (contributors) {
          traceFactor(contributors, 'target.vulnerability', 'Vulnerability', vulnerability);
          closeContributions(contributors, total);
        }

        return total;
      }

      const sigils = activeSigilSetAt(time, runtime);
      const sigilFactor = event.summonUsesEquipmentModifiers === false ? 1 : sigils.strike || 1;
      const sigilBonus =
        event.summonUsesEquipmentModifiers === false
          ? 0
          : Number.isFinite(Number(sigils.strikeAdd))
            ? Number(sigils.strikeAdd)
            : sigilFactor - 1;
      const timeOfDayMultiplier = config.timeOfDay === 'night' ? sigils.nightStrikeMultiplier || 1 : 1;
      const utilityMultiplier = 1 + (UTILITY_STRIKE_DAMAGE_BONUSES[config.utility || ''] || 0) / 100;
      // Independent factors retain their established order; only additive equipment enters the shared bucket.
      const equipmentFactor = modifier.acceptsDamageInputs ? 1 : sigilFactor + relicBonus;
      const base =
        vulnerability *
        equipmentFactor *
        timeOfDayMultiplier *
        (sigils.strikeMultiplier || 1) *
        utilityMultiplier *
        (config.modifiers?.strike || 1);
      const total = modifier(
        hookContext(time, {
          event,
          runtime,
          damageInputs: { strikeSigilBonus: sigilBonus, equipmentBonus: relicBonus },
          damageContributors: contributors
        }),
        base
      );
      if (contributors) {
        // Query-owned factors sit outside the profession hook; any untraced remainder stays visible as one entry.
        traceFactor(contributors, 'target.vulnerability', 'Vulnerability', vulnerability);
        traceFactor(contributors, 'equipment.sigils-and-relic', 'Sigils and relic', equipmentFactor);
        traceFactor(contributors, 'equipment.night', 'Night sigil', timeOfDayMultiplier);
        traceFactor(contributors, 'equipment.sigil-multiplier', 'Sigils', sigils.strikeMultiplier || 1);
        traceFactor(contributors, 'equipment.utility', 'Utility', utilityMultiplier);
        traceFactor(contributors, 'config.strike', 'Configured modifier', config.modifiers?.strike || 1);
        closeContributions(contributors, total);
      }

      return total;
    },
    conditionMultiplier(
      name: string,
      time: number,
      event: SimulationEvent | null = null,
      runtime: Gw2QueryRuntime | null = null,
      sample?: Gw2ConditionSample,
      contributors?: Gw2ModifierContribution[]
    ) {
      event = conditionOwnerEvent(event);
      const relicContext = runtime?.relic ? runtime : historicalRelicContext;
      const usesEquipmentModifiers = event?.summonUsesEquipmentModifiers !== false;
      const relicBonus = usesEquipmentModifiers ? relicOutgoingDamageBonus(relicContext, 'condition', time, event) : 0;
      const sigils = activeSigilSetAt(time, runtime);
      // Ordinary summon conditions use their player's bonuses; independent pet/mech owners never inherit Bursting.
      const usesSigil = usesEquipmentModifiers && !(event?.actorType === 'summon' && event.independentConditionOwner);
      const sigilFactor = usesSigil ? sigils.condition || 1 : 1;
      const sigilBonus = usesSigil
        ? Number.isFinite(Number(sigils.conditionAdd))
          ? Number(sigils.conditionAdd)
          : sigilFactor - 1
        : 0;
      const modifier = activeProfession.modifyConditionDamage as Gw2ModifierHook;
      const vulnerability = 1 + (sample?.vulnerabilityStacks ?? vulnerabilityStacksAt(time, runtime)) / 100;
      const equipmentFactor = modifier.acceptsDamageInputs ? 1 : sigilFactor + relicBonus;
      const base = vulnerability * equipmentFactor * (config.modifiers?.condition || 1);
      const total = modifier(
        hookContext(time, {
          event,
          condition: name,
          runtime,
          conditionSample: sample,
          damageInputs: { conditionSigilBonus: sigilBonus, equipmentBonus: relicBonus },
          damageContributors: contributors
        }),
        base
      );
      if (contributors) {
        traceFactor(contributors, 'target.vulnerability', 'Vulnerability', vulnerability);
        traceFactor(contributors, 'equipment.sigils-and-relic', 'Sigils and relic', equipmentFactor);
        traceFactor(contributors, 'config.condition', 'Configured modifier', config.modifiers?.condition || 1);
        closeContributions(contributors, total);
      }

      return total;
    },
    conditionDurationMultiplier(
      name: string,
      time: number,
      stats: Gw2ResolvedStats = statsAt(time),
      event: SimulationEvent | null = null,
      runtime: Gw2QueryRuntime | null = null,
      contributors?: Gw2ModifierContribution[]
    ) {
      event = conditionOwnerEvent(event);
      const sigils = activeSigilSetAt(time, runtime);
      const usesEquipmentModifiers = event?.summonUsesEquipmentModifiers !== false;
      const sigilBonus = usesEquipmentModifiers
        ? ((sigils.conditionDurationBonus || 0) + (sigils.conditionDurationBonuses?.[name] || 0)) / 100
        : 0;
      const relicBonus = usesEquipmentModifiers ? equipmentConditionDurationBonus(runtime, time) : 0;
      const base = gw2ConditionDurationMultiplier(name, stats, sigilBonus + relicBonus);
      if (contributors) {
        // Gear, sigils, and relics are summed into the base multiplier before profession rules run.
        traceBonus(contributors, 'stats.condition-duration', 'Expertise and gear', base - 1 - sigilBonus - relicBonus);
        traceBonus(contributors, 'equipment.sigils', 'Sigils', sigilBonus);
        traceBonus(contributors, 'equipment.relic', 'Relic', relicBonus);
      }

      const modified = activeProfession.modifyConditionDuration(
        hookContext(time, {
          event,
          condition: name,
          runtime,
          durationContributors: contributors
        }),
        base
      );
      // Clamped to [1, 2]: condition duration never drops below baseline and
      // cannot exceed +100% regardless of how many sources stack.
      const total = boundedNumber(modified || 1, 1, 1, 2);
      if (contributors) {
        traceFactor(contributors, 'duration.cap', 'Duration cap (+100%)', total / (modified || 1));
        closeContributions(contributors, total);
      }

      return total;
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
        activeProfession.modifyConditionBaseDuration(
          hookContext(time, {
            event,
            condition: name,
            runtime
          }),
          1
        ) || 0
      );
    },
    targetConditionStacks: targetConditionStacksAt,
    targetHasCondition(condition: string, time: number, runtime: Gw2QueryRuntime | null = null) {
      return targetHasCondition(config, condition, time, runtime, configuredTargetConditionStacks(condition));
    },
    timeline
  });
  query = completedQuery;
  return completedQuery;
}

export interface Gw2QueryRuntime extends Gw2RuntimeStateLike {
  readonly retiredCompanions?: ReadonlyMap<string, number>;
  readonly boons?: Map<string, Gw2TimedBuffApplication[]>;
  readonly buffs?: Map<string, Gw2TimedBuffApplication[]>;
  readonly activeWeaponSet?: number;
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
  didCrit?: boolean;
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
  /** An optional contributor sink receives every traced factor; it never changes the returned multiplier. */
  strikeMultiplier(
    event: SimulationEvent,
    time: number,
    runtime?: Gw2QueryRuntime | null,
    contributors?: Gw2ModifierContribution[]
  ): number;
  conditionMultiplier(
    name: string,
    time: number,
    event?: SimulationEvent | null,
    runtime?: Gw2QueryRuntime | null,
    sample?: Gw2ConditionSample,
    contributors?: Gw2ModifierContribution[]
  ): number;
  conditionDurationMultiplier(
    name: string,
    time: number,
    stats?: Gw2ResolvedStats,
    event?: SimulationEvent | null,
    runtime?: Gw2QueryRuntime | null,
    contributors?: Gw2ModifierContribution[]
  ): number;
  conditionBaseDurationMultiplier(
    name: string,
    time: number,
    event?: SimulationEvent | null,
    runtime?: Gw2QueryRuntime | null
  ): number;
  targetConditionStacks(condition: string, time: number, runtime?: Gw2QueryRuntime | null): number;
  targetHasCondition(condition: string, time: number, runtime?: Gw2QueryRuntime | null): boolean;
  readonly timeline: Readonly<Gw2TimelineIndex>;
}

/** Snapshots natural condition duration at application time; each phase owns its stacks and observation window. */
export function conditionApplicationDuration(
  query: Readonly<Gw2CombatQuery>,
  name: string,
  event: SimulationEvent,
  runtime: Gw2QueryRuntime,
  trace?: Gw2ConditionDurationTrace
): number {
  const stats = query.statsAt(event.at, event, runtime);
  const durationMultiplier = event.fixedDuration
    ? 1
    : query.conditionDurationMultiplier(name, event.at, stats, event, runtime, trace?.durationContributors);
  const baseDurationMultiplier = event.fixedDuration
    ? 1
    : query.conditionBaseDurationMultiplier(name, event.at, event, runtime);
  if (trace) {
    // Diagnostics reuse the multipliers computed for this application rather than querying again.
    trace.durationMultiplier = durationMultiplier;
    trace.baseDurationMultiplier = baseDurationMultiplier;
  }

  const duration = Math.max(0, event.duration || 0) * baseDurationMultiplier * durationMultiplier;
  return roundEffectDuration(duration);
}

/** Receives the duration facts of one application when a diagnostic caller asks for them. */
export interface Gw2ConditionDurationTrace {
  readonly durationContributors: Gw2ModifierContribution[];
  durationMultiplier?: number;
  baseDurationMultiplier?: number;
}
