import { expectedCritMultiplier, strikeDamage } from "../damage.js";
import { resolvedWeaponStrength } from "./weapon-strength-resolution.js";

import type {
  Gw2HitResolution,
  Gw2HitResolutionContext,
  Gw2ResolverExtensions,
  Gw2ResolvedWeaponStrength,
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
} from "../types.js";

const STANDARD_TARGET_ARMOR = 2597;

interface ResolvedStrikeParts {
  readonly baseDamage: number;
  readonly criticalMultiplier: number;
  readonly outgoingMultiplier: number;
  readonly weaponStrength: Gw2ResolvedWeaponStrength | null;
}

/**
 * Creates timestamp-aware strike resolution shared by GW2 professions.
 */
export function createGw2HitResolution({
  strikeMultiplier: equipmentStrikeMultiplier = () => 1,
}: {
  readonly strikeMultiplier?: Gw2ResolverExtensions["strikeMultiplier"];
} = {}): Readonly<Gw2HitResolution> {
  // Remaining target health as a fraction, or null when the encounter has no
  // configured target health. Shared by every "target-health-below" gate.
  function currentHealthFraction(ctx: Gw2ResolverRuntime): number | null {
    const maximum = Number(ctx.config.target?.health || 0);
    if (!(maximum > 0)) return null;
    const currentDamage =
      Number(ctx.totals.strike || 0) + Number(ctx.totals.condition || 0);
    return Math.max(0, 1 - currentDamage / maximum);
  }

  function coefficientMultiplier(
    ctx: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
  ): number {
    const modifiers = Array.isArray(event.coefficientModifiers)
      ? event.coefficientModifiers
      : [];
    if (!modifiers.length) return 1;
    const healthFraction = currentHealthFraction(ctx);
    if (healthFraction == null) return 1;
    const selected = modifiers
      .filter(
        (modifier) =>
          modifier?.kind === "target-health-below" &&
          healthFraction < Number(modifier.threshold),
      )
      .sort(
        (left, right) => Number(left.threshold) - Number(right.threshold),
      )[0];
    return selected ? Number(selected.multiplier) : 1;
  }

  function targetArmorFor(ctx: Gw2ResolverRuntime): number {
    return Math.max(
      1,
      Number(ctx.config.target?.armor || STANDARD_TARGET_ARMOR),
    );
  }

  // A shared crit outcome (stochastic) feeds both reactions and on-crit effects.
  // Strike damage stays expected-valued, so didCrit only isolates proc RNG.
  function resolveCritical(
    ctx: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
    flatStrike: boolean,
  ): Gw2HitResolutionContext["critical"] {
    const critical = ctx.query.critical(event, event.at, ctx);
    if (event.noCrit || flatStrike) critical.chance = 0;
    critical.didCrit = ctx.random?.stochastic
      ? typeof event.didCrit === "boolean"
        ? event.didCrit
        : ctx.random.roll(
            critical.chance,
            `critical:${String(event.actorType || "player")}`,
          )
      : null;
    return critical;
  }

  // Flat strikes ignore weapon strength and crit; a single health threshold may
  // scale the fixed multiplier once the target drops below it.
  function resolveFlatStrike(
    ctx: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
    power: number,
  ): ResolvedStrikeParts {
    let outgoingMultiplier = Number(event.flatStrikeMultiplier ?? 1);
    const threshold = Number(event.flatStrikeHealthThreshold || 0);
    const healthFraction = currentHealthFraction(ctx);
    if (threshold > 0 && healthFraction != null && healthFraction < threshold) {
      outgoingMultiplier *= Number(event.flatStrikeThresholdMultiplier ?? 1);
    }
    const baseDamage =
      Number(event.flatDamage ?? event.flatStrikeBase ?? 0) +
      Number(event.flatStrikePowerCoeff || 0) * power;
    return {
      baseDamage,
      criticalMultiplier: 1,
      outgoingMultiplier,
      weaponStrength: null,
    };
  }

  // Power-scaling strikes: normal skills and independent summons share crit and
  // outgoing multipliers. Only base damage / weapon strength differ.
  function resolveScalingStrike(
    ctx: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
    power: number,
    critical: Gw2HitResolutionContext["critical"],
  ): ResolvedStrikeParts {
    const criticalMultiplier = expectedCritMultiplier(
      critical.chance * 100,
      critical.damage * 100,
    );
    const outgoingMultiplier =
      ctx.query.strikeMultiplier(event, event.at, ctx) *
      equipmentStrikeMultiplier(ctx, event);
    const targetArmor = targetArmorFor(ctx);

    const summonDamagePerCoefficient = Number(event.summonDamagePerCoefficient);
    const summonWeaponStrengthProfile =
      event.independentSummonStrike === true &&
      typeof event.weaponStrengthProfileId === "string" &&
      event.weaponStrengthProfileId.length > 0;
    const independentSummonStrike =
      event.independentSummonStrike === true &&
      (summonWeaponStrengthProfile ||
        (Number.isFinite(summonDamagePerCoefficient) &&
          Number(event.summonBasePower) > 0));

    // Independent summons without a weapon-strength profile scale off a fixed
    // base-power ratio instead of the player's weapon strength.
    if (independentSummonStrike && !summonWeaponStrengthProfile) {
      const baseDamage =
        (((Number(event.coefficient || 0) *
          summonDamagePerCoefficient *
          power) /
          Number(event.summonBasePower)) *
          STANDARD_TARGET_ARMOR) /
        targetArmor;
      return {
        baseDamage,
        criticalMultiplier,
        outgoingMultiplier,
        weaponStrength: null,
      };
    }

    const weaponStrength = resolvedWeaponStrength(ctx, event);
    const baseDamage = strikeDamage(
      Number(event.coefficient || 0) * coefficientMultiplier(ctx, event),
      weaponStrength.value,
      power,
      targetArmor,
    );
    return {
      baseDamage,
      criticalMultiplier,
      outgoingMultiplier,
      weaponStrength,
    };
  }

  function buildHitResolutionContext(
    ctx: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
  ): Gw2HitResolutionContext {
    const stats = ctx.query.statsAt(event.at, event, ctx);
    const flatStrike =
      Number.isFinite(event.flatDamage) ||
      Number.isFinite(event.flatStrikeBase) ||
      Number.isFinite(event.flatStrikePowerCoeff);
    const critical = resolveCritical(ctx, event, flatStrike);
    const critEligible =
      !flatStrike && !event.noCrit && event.canCrit !== false;
    const strike = flatStrike
      ? resolveFlatStrike(ctx, event, stats.power)
      : resolveScalingStrike(ctx, event, stats.power, critical);

    return {
      stats,
      critical,
      critEligible,
      criticalMultiplier: strike.criticalMultiplier,
      outgoingMultiplier: strike.outgoingMultiplier,
      weaponStrength: strike.weaponStrength,
      baseDamage: strike.baseDamage,
      damage:
        strike.baseDamage *
        strike.criticalMultiplier *
        strike.outgoingMultiplier,
    };
  }

  function applyResolvedHit(
    ctx: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
    hitContext: Gw2HitResolutionContext,
  ): Gw2ResolverEvent {
    const damage = hitContext.damage;
    ctx.totals.strike += damage;
    ctx.addBreakdown(
      event.name || event.skillName || String(event.sourceId),
      damage,
      "strikeDamage",
      Number(event.hits || 1),
      event,
      hitContext.critEligible ? hitContext.critical : null,
    );
    if (damage > 0) ctx.markDamageTime(event.at);

    const resolved = {
      ...event,
      ...(hitContext.weaponStrength
        ? {
            activationId:
              hitContext.weaponStrength.activationId ?? event.activationId,
            weaponStrengthProfileId: hitContext.weaponStrength.profileId,
            resolvedWeaponStrength: hitContext.weaponStrength.value,
            weaponStrengthSampled: hitContext.weaponStrength.sampled,
          }
        : {}),
      damage,
      criticalChance: hitContext.critical.chance,
      criticalChanceBeforeCap: hitContext.critical.chanceBeforeCap,
      criticalChanceContributors: hitContext.critical.contributors,
      criticalDamage: hitContext.critical.damage,
      critEligible: hitContext.critEligible,
    } as Gw2ResolverEvent;
    ctx.resolved.push(resolved);
    return resolved;
  }

  return Object.freeze({
    buildHitResolutionContext,
    applyResolvedHit,
  });
}
