import type { Gw2ResolvedStats } from '#gw2/platform/attributes/stats.js';
import type { Gw2CriticalResult } from '#gw2/platform/combat-calculation/combat-query.js';
import { expectedCritMultiplier, STANDARD_TARGET_ARMOR, strikeDamage } from '#gw2/platform/combat/formulas.js';
import type { Gw2ModifierContribution } from '#gw2/platform/combat/modifiers.js';
import { remainingTargetHealthFraction } from '#gw2/platform/combat/state/target-health.js';
import type { Gw2ResolvedWeaponStrength } from '#gw2/platform/equipment/weapons/types.js';
import type { Gw2DamageCalculation } from '#gw2/platform/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import { resolvedWeaponStrength } from '#gw2/platform/resolver/weapon-strength-resolution.js';
import { roundHalfToEven } from '#kernel/core/numeric.js';

interface ResolvedStrikeParts {
  readonly targetArmor: number | null;
  readonly baseDamage: number;
  readonly criticalMultiplier: number;
  readonly outgoingMultiplier: number;
  readonly outgoingContributors?: readonly Gw2ModifierContribution[];
  readonly weaponStrength: Gw2ResolvedWeaponStrength | null;
}

/**
 * Creates timestamp-aware strike resolution with the caller's equipment multiplier policy.
 */
export function createGw2HitResolution({
  strikeMultiplier: equipmentStrikeMultiplier,
  activeBuffs
}: {
  readonly strikeMultiplier: (context: Gw2ResolverRuntime, event: Gw2ResolverEvent) => number;
  readonly activeBuffs: () => Gw2DamageCalculation['activeBuffs'];
}): Readonly<Gw2HitResolution> {
  // Flat-strike thresholds use the same remaining-health query as ordinary modifier predicates.
  function currentHealthFraction(ctx: Gw2ResolverRuntime): number | null {
    return remainingTargetHealthFraction(ctx.config, ctx);
  }

  function targetArmorFor(ctx: Gw2ResolverRuntime): number {
    // Boss encounters own target armor; Golem retains its authored armor setting.
    return ctx.encounter?.armor ?? Math.max(1, ctx.config.target?.armor || STANDARD_TARGET_ARMOR);
  }

  // Sample once for proc eligibility and reporting; rolled damage reuses this same outcome.
  function resolveCritical(
    ctx: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
    flatStrike: boolean,
    stats: Gw2ResolvedStats,
    damageContributors?: Gw2ModifierContribution[]
  ): Gw2HitResolutionContext['critical'] {
    if (event.canCrit === false || flatStrike) {
      return {
        chance: 0,
        chanceBeforeCap: 0,
        contributors: [],
        damage: 1,
        didCrit: false
      };
    }

    const critical = ctx.query.critical(event, event.at, ctx, stats, damageContributors);
    critical.didCrit =
      typeof event.didCrit === 'boolean'
        ? event.didCrit
        : ctx.random.roll(critical.chance, `critical:${event.actorType}`);
    return critical;
  }

  // Flat strikes ignore weapon strength and crit; a single health threshold may
  // scale the fixed multiplier once the target drops below it.
  function resolveFlatStrike(
    ctx: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
    stats: Gw2ResolvedStats
  ): ResolvedStrikeParts {
    let outgoingMultiplier = event.flatStrikeMultiplier ?? 1;
    const threshold = event.flatStrikeHealthThreshold || 0;
    const healthFraction = currentHealthFraction(ctx);

    if (threshold > 0 && healthFraction != null && healthFraction < threshold) {
      outgoingMultiplier *= event.flatStrikeThresholdMultiplier ?? 1;
    }

    // Non-condition effects such as Agony use the live attribute while retaining the flat packet's modifier bypass.
    const baseDamage =
      (event.flatDamage ?? event.flatStrikeBase ?? 0) +
      (event.flatStrikePowerCoeff || 0) * stats.power +
      (event.flatDamageConditionCoeff ? event.flatDamageConditionCoeff * stats.conditionDamage : 0);
    return {
      baseDamage,
      targetArmor: null,
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
    // Averaged baselines smooth damage; rolled baselines and RNG trials use the reported crit outcome.
    const criticalMultiplier =
      ctx.criticalDamageMode === 'averaged'
        ? expectedCritMultiplier(critical.chance, critical.damage)
        : critical.didCrit
          ? critical.damage
          : 1;
    // Diagnostics trace the same multiplier call; ordinary runs pass no sink and record nothing.
    const outgoingContributors: Gw2ModifierContribution[] | undefined = ctx.damageDiagnostics ? [] : undefined;
    const queryMultiplier = ctx.query.strikeMultiplier(event, event.at, ctx, outgoingContributors);
    const equipmentMultiplier =
      event.summonUsesEquipmentModifiers === false ? 1 : equipmentStrikeMultiplier(ctx, event);

    if (outgoingContributors && equipmentMultiplier !== 1)
      outgoingContributors.push({
        id: 'equipment.strike',
        label: 'Equipment',
        bucket: 'multiplier',
        value: equipmentMultiplier
      });

    const outgoingMultiplier = queryMultiplier * equipmentMultiplier;
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
        ((((event.coefficient || 0) * summonDamagePerCoefficient * power) / Number(event.summonBasePower)) *
          STANDARD_TARGET_ARMOR) /
        targetArmor;
      return {
        baseDamage,
        targetArmor,
        criticalMultiplier,
        outgoingMultiplier,
        outgoingContributors,
        weaponStrength: null
      };
    }

    const weaponStrength = resolvedWeaponStrength(ctx, event);
    const baseDamage = strikeDamage(event.coefficient || 0, weaponStrength.value, power, targetArmor);
    return {
      baseDamage,
      targetArmor,
      criticalMultiplier,
      outgoingMultiplier,
      outgoingContributors,
      weaponStrength
    };
  }

  function buildHitResolutionContext(ctx: Gw2ResolverRuntime, event: Gw2ResolverEvent): Gw2HitResolutionContext {
    const stats = ctx.query.statsAt(event.at, event, ctx);
    const flatStrike =
      Number.isFinite(event.flatDamage) ||
      Number.isFinite(event.flatStrikeBase) ||
      Number.isFinite(event.flatStrikePowerCoeff);
    // Diagnostics trace the same critical query; ordinary runs pass no sink and record nothing.
    const criticalDamageContributors: Gw2ModifierContribution[] | undefined = ctx.damageDiagnostics ? [] : undefined;
    const critical = resolveCritical(ctx, event, flatStrike, stats, criticalDamageContributors);
    const critEligible = !flatStrike && event.canCrit !== false;
    const strike = flatStrike
      ? resolveFlatStrike(ctx, event, stats)
      : resolveScalingStrike(ctx, event, stats.power, critical);
    const damage = strike.baseDamage * strike.criticalMultiplier * strike.outgoingMultiplier;

    return {
      stats,
      // Preserve the struck target's health before damage can switch targets or replace its health bar.
      targetHealthFractionBefore: currentHealthFraction(ctx),
      targetArmor: strike.targetArmor,
      unroundedDamage: damage,
      critical,
      critEligible,
      criticalMultiplier: strike.criticalMultiplier,
      ...(criticalDamageContributors?.length ? { criticalDamageContributors } : {}),
      outgoingMultiplier: strike.outgoingMultiplier,
      ...(strike.outgoingContributors ? { outgoingContributors: strike.outgoingContributors } : {}),
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
    let damage = hitContext.damage;
    // Reactions receive the existing hit context; only returned rows need a detached hit packet. Ownership reads the
    // packet's resolved activation, so measurements discard unowned copies before diagnostics are assembled.
    const candidate = ctx.output === 'score' ? null : resolvedHitPacket(ctx, event, hitContext);
    const resolved = candidate && ctx.retainsResolved(candidate) ? candidate : null;

    // Copy already computed facts before health commits; diagnostics never query modifiers or consume RNG again.
    if (resolved && ctx.damageDiagnostics) {
      const maximum = Number(ctx.encounter?.maximumHealth ?? ctx.config.target?.health);
      const healthFraction = hitContext.targetHealthFractionBefore;
      const damageCalculation: Gw2DamageCalculation = {
        activeBuffs: activeBuffs(),
        phase: (['Sample', 'Settle', 'Buffs', 'Ordinary'] as const)[ctx.queue.currentPhase] ?? 'Ordinary',
        targetHealthBefore: healthFraction == null || !Number.isFinite(maximum) ? null : maximum * healthFraction,
        targetHealthFractionBefore: healthFraction,
        power: hitContext.stats.power,
        ...(Number.isFinite(hitContext.stats.precision) ? { precision: hitContext.stats.precision } : {}),
        ...(Number.isFinite(hitContext.stats.ferocity) ? { ferocity: hitContext.stats.ferocity } : {}),
        ...(hitContext.targetArmor == null ? {} : { targetArmor: hitContext.targetArmor }),
        baseDamage: hitContext.baseDamage,
        criticalMultiplier: hitContext.criticalMultiplier,
        ...(hitContext.criticalDamageContributors
          ? { criticalDamageContributors: hitContext.criticalDamageContributors }
          : {}),
        outgoingMultiplier: hitContext.outgoingMultiplier,
        ...(hitContext.outgoingContributors ? { outgoingContributors: hitContext.outgoingContributors } : {}),
        unroundedDamage: hitContext.unroundedDamage,
        rounding: event.damageKind === 'condition' ? 'half-even' : 'floor'
      };
      Object.assign(resolved, { damageCalculation });
    }

    // Clamp the packet at a health gate before attribution so overkill cannot leak across a split.
    damage = ctx.encounter?.damage(damage, 'player', event.at) ?? damage;

    if (resolved) Object.assign(resolved, { damage });

    const damageType = event.damageKind === 'condition' ? 'conditionDamage' : 'strikeDamage';

    if (damageType === 'conditionDamage') ctx.totals.condition += damage;
    else ctx.totals.strike += damage;

    // Report only the encounter-accepted amount and the already resolved critical verdict.
    ctx.damageRecorder?.recordDamage({
      name: event.name || event.skillName || String(event.sourceId),
      damage,
      component: damageType,
      hits: damageType === 'strikeDamage' ? event.hits || 1 : 0,
      source: event,
      didCrit: damageType === 'strikeDamage' && hitContext.critEligible ? hitContext.critical.didCrit === true : null
    });

    if (damage > 0) ctx.markDamageTime(event.at);

    if (resolved) ctx.resolved.push(resolved);
  }

  /** Detaches one hit's resolved facts from its scheduled packet for reports and measurements. */
  function resolvedHitPacket(
    ctx: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
    hitContext: Gw2HitResolutionContext
  ): Gw2ResolverEvent {
    return {
      ...event,
      ...(hitContext.weaponStrength
        ? {
            activationId: hitContext.weaponStrength.activationId ?? event.activationId,
            weaponStrengthProfileId: hitContext.weaponStrength.profileId,
            resolvedWeaponStrength: hitContext.weaponStrength.value,
            weaponStrengthSampled: hitContext.weaponStrength.sampled
          }
        : {}),
      damage: hitContext.damage,
      didCrit: hitContext.critical.didCrit,
      averagedCriticalDamage: ctx.criticalDamageMode === 'averaged' && hitContext.critEligible,
      criticalChance: hitContext.critical.chance,
      criticalChanceBeforeCap: hitContext.critical.chanceBeforeCap,
      criticalChanceContributors: hitContext.critical.contributors,
      criticalDamage: hitContext.critical.damage,
      critEligible: hitContext.critEligible
    };
  }

  return Object.freeze({
    buildHitResolutionContext,
    applyResolvedHit
  });
}

export interface Gw2HitResolutionContext {
  readonly targetHealthFractionBefore: number | null;
  /** Armor divisor of a scaling strike; null for fixed packets. */
  readonly targetArmor: number | null;
  readonly unroundedDamage: number;
  readonly stats: Gw2ResolvedStats;
  readonly critical: Gw2CriticalResult;
  // Whether this strike can crit at all (scaling strike, not flagged canCrit=false). Non-eligible hits are excluded from crit-rate reporting.
  readonly critEligible: boolean;
  readonly criticalMultiplier: number;
  /** Present only in diagnostic runs: ordered steps that build the critical-hit multiplier. */
  readonly criticalDamageContributors?: readonly Gw2ModifierContribution[];
  readonly outgoingMultiplier: number;
  /** Present only in diagnostic runs: the traced factors behind outgoingMultiplier. */
  readonly outgoingContributors?: readonly Gw2ModifierContribution[];
  readonly weaponStrength: Gw2ResolvedWeaponStrength | null;
  readonly baseDamage: number;
  readonly damage: number;
}

export interface Gw2HitResolution {
  buildHitResolutionContext(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): Gw2HitResolutionContext;
  applyResolvedHit(context: Gw2ResolverRuntime, event: Gw2ResolverEvent, hit: Gw2HitResolutionContext): void;
}
