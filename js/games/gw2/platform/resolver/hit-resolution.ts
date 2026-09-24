import type { Gw2DamageCalculation } from '#gw2/platform/engine/events/events.js';
import { expectedCritMultiplier, strikeDamage } from '#gw2/platform/combat/formulas.js';
import type { Gw2CriticalResult, Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';
import { remainingTargetHealthFraction } from '#gw2/platform/combat/state/target-health.js';
import type { SimulationActorType } from '#gw2/platform/engine/events/actors.js';
import type { Gw2ResolvedWeaponStrength } from '#gw2/platform/equipment/weapons/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { resolvedWeaponStrength } from '#gw2/platform/resolver/weapon-strength-resolution.js';
import { roundHalfToEven } from '#kernel/core/numeric.js';

const STANDARD_TARGET_ARMOR = 2597;

interface ResolvedStrikeParts {
  readonly coefficientMultiplier: number;
  readonly baseDamage: number;
  readonly criticalMultiplier: number;
  readonly outgoingMultiplier: number;
  readonly weaponStrength: Gw2ResolvedWeaponStrength | null;
}

/**
 * Creates timestamp-aware strike resolution shared by GW2 professions.
 */
export function createGw2HitResolution({
  strikeMultiplier: equipmentStrikeMultiplier = () => 1
}: {
  readonly strikeMultiplier?: (context: Gw2ResolverRuntime, event: Gw2ResolverEvent) => number;
} = {}): Readonly<Gw2HitResolution> {
  // Remaining target health as a fraction, or null when the encounter has no
  // configured target health. Shared by every "target-health-below" gate.
  function currentHealthFraction(ctx: Gw2ResolverRuntime): number | null {
    return remainingTargetHealthFraction(ctx.config, ctx);
  }

  function coefficientMultiplier(ctx: Gw2ResolverRuntime, event: Gw2ResolverEvent): number {
    const modifiers = Array.isArray(event.coefficientModifiers) ? event.coefficientModifiers : [];
    if (!modifiers.length) return 1;
    const healthFraction = currentHealthFraction(ctx);
    if (healthFraction == null) return 1;
    const selected = modifiers
      .filter((modifier) => modifier?.kind === 'target-health-below' && healthFraction < Number(modifier.threshold))
      .sort((left, right) => Number(left.threshold) - Number(right.threshold))[0];
    return selected ? Number(selected.multiplier) : 1;
  }

  function targetArmorFor(ctx: Gw2ResolverRuntime): number {
    return Math.max(1, Number(ctx.config.target?.armor || STANDARD_TARGET_ARMOR));
  }

  // Both modes share seeded crit outcomes for reactions while retaining average critical damage.
  // Strike damage stays expected-valued, so didCrit only isolates proc RNG.
  function resolveCritical(
    ctx: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
    flatStrike: boolean
  ): Gw2HitResolutionContext['critical'] {
    if (event.noCrit || flatStrike) {
      return {
        chance: 0,
        chanceBeforeCap: 0,
        contributors: [],
        damage: 1,
        didCrit: false
      };
    }

    const critical = ctx.query.critical(event, event.at, ctx);
    critical.didCrit =
      typeof event.didCrit === 'boolean'
        ? event.didCrit
        : ctx.random.roll(critical.chance, `critical:${String(event.actorType || 'player')}`);
    return critical;
  }

  // Flat strikes ignore weapon strength and crit; a single health threshold may
  // scale the fixed multiplier once the target drops below it.
  function resolveFlatStrike(ctx: Gw2ResolverRuntime, event: Gw2ResolverEvent, power: number): ResolvedStrikeParts {
    let outgoingMultiplier = Number(event.flatStrikeMultiplier ?? 1);
    const threshold = Number(event.flatStrikeHealthThreshold || 0);
    const healthFraction = currentHealthFraction(ctx);
    if (threshold > 0 && healthFraction != null && healthFraction < threshold) {
      outgoingMultiplier *= Number(event.flatStrikeThresholdMultiplier ?? 1);
    }

    const baseDamage =
      Number(event.flatDamage ?? event.flatStrikeBase ?? 0) + Number(event.flatStrikePowerCoeff || 0) * power;
    return {
      baseDamage,
      coefficientMultiplier: 1,
      criticalMultiplier: 1,
      outgoingMultiplier,
      weaponStrength: null
    };
  }

  // Power-scaling strikes: normal skills and independent summons share crit and
  // outgoing multipliers. Only base damage / weapon strength differ.
  function resolveScalingStrike(
    ctx: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
    power: number,
    critical: Gw2HitResolutionContext['critical']
  ): ResolvedStrikeParts {
    // Damage retains the average crit multiplier; the sampled outcome governs proc eligibility only.
    const criticalMultiplier = expectedCritMultiplier(critical.chance, critical.damage);
    const outgoingMultiplier =
      ctx.query.strikeMultiplier(event, event.at, ctx) *
      (event.summonUsesEquipmentModifiers === false ? 1 : equipmentStrikeMultiplier(ctx, event));
    const targetArmor = targetArmorFor(ctx);

    const summonDamagePerCoefficient = Number(event.summonDamagePerCoefficient);
    const summonWeaponStrengthProfile =
      event.independentSummonStrike === true &&
      typeof event.weaponStrengthProfileId === 'string' &&
      event.weaponStrengthProfileId.length > 0;
    const independentSummonStrike =
      event.independentSummonStrike === true &&
      (summonWeaponStrengthProfile ||
        (Number.isFinite(summonDamagePerCoefficient) && Number(event.summonBasePower) > 0));

    // Independent summons without a weapon-strength profile scale off a fixed
    // base-power ratio instead of the player's weapon strength.
    if (independentSummonStrike && !summonWeaponStrengthProfile) {
      const baseDamage =
        (((Number(event.coefficient || 0) * summonDamagePerCoefficient * power) / Number(event.summonBasePower)) *
          STANDARD_TARGET_ARMOR) /
        targetArmor;
      return {
        baseDamage,
        coefficientMultiplier: 1,
        criticalMultiplier,
        outgoingMultiplier,
        weaponStrength: null
      };
    }

    const weaponStrength = resolvedWeaponStrength(ctx, event);
    const effectiveCoefficientMultiplier = coefficientMultiplier(ctx, event);
    const baseDamage = strikeDamage(
      Number(event.coefficient || 0) * effectiveCoefficientMultiplier,
      weaponStrength.value,
      power,
      targetArmor
    );
    return {
      baseDamage,
      coefficientMultiplier: effectiveCoefficientMultiplier,
      criticalMultiplier,
      outgoingMultiplier,
      weaponStrength
    };
  }

  function buildHitResolutionContext(ctx: Gw2ResolverRuntime, event: Gw2ResolverEvent): Gw2HitResolutionContext {
    const stats = ctx.query.statsAt(event.at, event, ctx);
    const flatStrike =
      Number.isFinite(event.flatDamage) ||
      Number.isFinite(event.flatStrikeBase) ||
      Number.isFinite(event.flatStrikePowerCoeff);
    const critical = resolveCritical(ctx, event, flatStrike);
    const critEligible = !flatStrike && !event.noCrit && event.canCrit !== false;
    const strike = flatStrike
      ? resolveFlatStrike(ctx, event, stats.power)
      : resolveScalingStrike(ctx, event, stats.power, critical);
    const damage = strike.baseDamage * strike.criticalMultiplier * strike.outgoingMultiplier;

    return {
      stats,
      coefficientMultiplier: strike.coefficientMultiplier,
      unroundedDamage: damage,
      critical,
      critEligible,
      criticalMultiplier: strike.criticalMultiplier,
      outgoingMultiplier: strike.outgoingMultiplier,
      weaponStrength: strike.weaponStrength,
      baseDamage: strike.baseDamage,
      // Round the final packet before reactions and totals: strikes floor, condition packets use half-even.
      damage: event.damageKind === 'condition' ? roundHalfToEven(damage) : Math.floor(damage)
    };
  }

  function applyResolvedHit(
    ctx: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
    hitContext: Gw2HitResolutionContext
  ): void {
    const damage = hitContext.damage;
    // Copy already computed facts before health commits; diagnostics never query modifiers or consume RNG again.
    let damageCalculation: Gw2DamageCalculation | undefined;
    if (ctx.damageDiagnostics) {
      const maximum = Number(ctx.config.target?.health);
      const healthFraction = Number.isFinite(maximum) ? currentHealthFraction(ctx) : null;
      damageCalculation = {
        phase: (['Sample', 'Settle', 'Ordinary'] as const)[ctx.queue.currentPhase] ?? 'Ordinary',
        targetHealthBefore: healthFraction == null ? null : maximum * healthFraction,
        targetHealthFractionBefore: healthFraction,
        power: hitContext.stats.power,
        ...(Number.isFinite(hitContext.stats.precision) ? { precision: hitContext.stats.precision } : {}),
        ...(Number.isFinite(hitContext.stats.ferocity) ? { ferocity: hitContext.stats.ferocity } : {}),
        coefficientMultiplier: hitContext.coefficientMultiplier,
        baseDamage: hitContext.baseDamage,
        criticalMultiplier: hitContext.criticalMultiplier,
        outgoingMultiplier: hitContext.outgoingMultiplier,
        unroundedDamage: hitContext.unroundedDamage,
        rounding: event.damageKind === 'condition' ? 'half-even' : 'floor'
      };
    }

    const damageType = event.damageKind === 'condition' ? 'conditionDamage' : 'strikeDamage';
    if (damageType === 'conditionDamage') ctx.totals.condition += damage;
    else ctx.totals.strike += damage;
    ctx.addBreakdown(
      event.name || event.skillName || String(event.sourceId),
      damage,
      damageType,
      damageType === 'strikeDamage' ? Number(event.hits || 1) : 0,
      event,
      damageType === 'strikeDamage' && hitContext.critEligible ? hitContext.critical : null
    );
    if (damage > 0) ctx.markDamageTime(event.at);

    const resolved = {
      ...event,
      ...(damageCalculation ? { damageCalculation } : {}),
      ...(hitContext.weaponStrength
        ? {
            activationId: hitContext.weaponStrength.activationId ?? event.activationId,
            weaponStrengthProfileId: hitContext.weaponStrength.profileId,
            resolvedWeaponStrength: hitContext.weaponStrength.value,
            weaponStrengthSampled: hitContext.weaponStrength.sampled
          }
        : {}),
      damage,
      didCrit: hitContext.critical.didCrit,
      criticalChance: hitContext.critical.chance,
      criticalChanceBeforeCap: hitContext.critical.chanceBeforeCap,
      criticalChanceContributors: hitContext.critical.contributors,
      criticalDamage: hitContext.critical.damage,
      critEligible: hitContext.critEligible
    } as Gw2ResolverEvent;
    // Reactions still receive the resolved hit, but score jobs do not retain a strike history.
    if (ctx.reporting) ctx.resolved.push(resolved);
  }

  return Object.freeze({
    buildHitResolutionContext,
    applyResolvedHit
  });
}

/** Aggregates resolved damage and critical-hit accounting for one skill or effect. */
export interface Gw2DamageBreakdownEntry {
  name: string;
  sourceSkill: string;
  parentSkill: string;
  damageBreakdownName?: string;
  icon: string;
  skillId?: import('#gw2/platform/engine/skills/types.js').SkillId | null;
  sourceId?: import('#gw2/platform/engine/skills/types.js').SkillId;
  actorType?: SimulationActorType;
  summonKind?: string;
  source?: string;
  damage: number;
  strikeDamage: number;
  conditionDamage: number;
  hits: number;
  casts?: number;
  // Crit accounting counts seeded critical outcomes in both modes;
  // critEligibleHits is the number of strike hits those crits are drawn from.
  critHits?: number;
  critEligibleHits?: number;
}

export interface Gw2HitResolutionContext {
  readonly coefficientMultiplier: number;
  readonly unroundedDamage: number;
  readonly stats: Gw2ResolvedStats;
  readonly critical: Gw2CriticalResult;
  // Whether this strike can crit at all (scaling strike, not flagged noCrit /
  // canCrit=false). Non-eligible hits are excluded from crit-rate reporting.
  readonly critEligible: boolean;
  readonly criticalMultiplier: number;
  readonly outgoingMultiplier: number;
  readonly weaponStrength: Gw2ResolvedWeaponStrength | null;
  readonly baseDamage: number;
  readonly damage: number;
}

export interface Gw2HitResolution {
  buildHitResolutionContext(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): Gw2HitResolutionContext;
  applyResolvedHit(context: Gw2ResolverRuntime, event: Gw2ResolverEvent, hit: Gw2HitResolutionContext): void;
}
