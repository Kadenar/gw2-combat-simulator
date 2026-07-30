import { expectedCritMultiplier, strikeDamage } from "../damage.js";
import { relicStrikeMultiplier } from "../relic-rules.js";
import { resolvedWeaponStrength } from "./weapon-strength-resolution.js";

import type {
  Gw2HitResolution,
  Gw2HitResolutionContext,
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
} from "../types.js";

interface CreateGw2HitResolutionOptions {
  readonly targetHealthMultiplier?: (
    context: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
  ) => number;
}

const STANDARD_TARGET_ARMOR = 2597;

/**
 * Creates timestamp-aware strike resolution shared by GW2 professions.
 * Profession-specific health gates and other final modifiers are injected.
 */
export function createGw2HitResolution({
  targetHealthMultiplier = () => 1,
}: CreateGw2HitResolutionOptions = {}): Readonly<Gw2HitResolution> {
  function coefficientMultiplier(
    ctx: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
  ): number {
    const modifiers = Array.isArray(event.coefficientModifiers)
      ? event.coefficientModifiers
      : [];
    if (!modifiers.length) return 1;
    const maximum = Number(ctx.config.target?.health || 0);
    if (!(maximum > 0)) return 1;
    const currentDamage =
      Number(ctx.totals.strike || 0) + Number(ctx.totals.condition || 0);
    const healthFraction = Math.max(0, 1 - currentDamage / maximum);
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

  function buildHitResolutionContext(
    ctx: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
  ): Gw2HitResolutionContext {
    const stats = ctx.query.statsAt(event.at, event, ctx);
    const flatStrike =
      Number.isFinite(event.flatDamage) ||
      Number.isFinite(event.flatStrikeBase) ||
      Number.isFinite(event.flatStrikePowerCoeff);
    const critical = ctx.query.critical(event, event.at, ctx);
    if (event.noCrit || flatStrike) critical.chance = 0;
    // Stochastic mode uses one shared crit outcome for reactions and on-crit
    // sigils. Strike damage remains expected-valued so this isolates proc RNG.
    critical.didCrit = ctx.random?.stochastic
      ? typeof event.didCrit === "boolean"
        ? event.didCrit
        : ctx.random.roll(
            critical.chance,
            `critical:${String(event.actorType || "player")}`,
          )
      : null;
    const criticalMultiplier = flatStrike
      ? 1
      : expectedCritMultiplier(critical.chance * 100, critical.damage * 100);
    const outgoingMultiplier = flatStrike
      ? (() => {
          let multiplier = Number(event.flatStrikeMultiplier ?? 1);
          const maximum = Number(ctx.config.target?.health || 0);
          const threshold = Number(event.flatStrikeHealthThreshold || 0);
          const currentDamage =
            Number(ctx.totals.strike || 0) + Number(ctx.totals.condition || 0);
          if (
            maximum > 0 &&
            threshold > 0 &&
            currentDamage > maximum * (1 - threshold)
          ) {
            multiplier *= Number(event.flatStrikeThresholdMultiplier ?? 1);
          }
          return multiplier;
        })()
      : ctx.query.strikeMultiplier(event, event.at, ctx) *
        relicStrikeMultiplier(ctx, event) *
        targetHealthMultiplier(ctx, event);
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
    const targetArmor = Math.max(
      1,
      Number(ctx.config.target?.armor || STANDARD_TARGET_ARMOR),
    );
    const strength =
      !flatStrike && (!independentSummonStrike || summonWeaponStrengthProfile)
        ? resolvedWeaponStrength(ctx, event)
        : null;
    const baseDamage = flatStrike
      ? Number(event.flatDamage ?? event.flatStrikeBase ?? 0) +
        Number(event.flatStrikePowerCoeff || 0) * stats.power
      : independentSummonStrike
        ? strength
          ? strikeDamage(
              Number(event.coefficient || 0) *
                coefficientMultiplier(ctx, event),
              strength.value,
              stats.power,
              targetArmor,
            )
          : (((Number(event.coefficient || 0) *
              summonDamagePerCoefficient *
              stats.power) /
              Number(event.summonBasePower)) *
              STANDARD_TARGET_ARMOR) /
            targetArmor
        : strikeDamage(
            Number(event.coefficient || 0) * coefficientMultiplier(ctx, event),
            strength!.value,
            stats.power,
            targetArmor,
          );

    return {
      stats,
      critical,
      criticalMultiplier,
      outgoingMultiplier,
      weaponStrength: strength,
      baseDamage,
      damage: baseDamage * criticalMultiplier * outgoingMultiplier,
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
      criticalDamage: hitContext.critical.damage,
    } as Gw2ResolverEvent;
    ctx.resolved.push(resolved);
    return resolved;
  }

  return Object.freeze({
    buildHitResolutionContext,
    applyResolvedHit,
  });
}
