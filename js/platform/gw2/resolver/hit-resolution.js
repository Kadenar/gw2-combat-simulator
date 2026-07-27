import {
  expectedCritMultiplier,
  strikeDamage,
} from "../damage.js";
import { relicStrikeMultiplier } from "../relic-rules.js";

/**
 * Creates timestamp-aware strike resolution shared by GW2 professions.
 * Profession-specific health gates and other final modifiers are injected.
 */
export function createGw2HitResolution({
  targetHealthMultiplier = () => 1,
} = {}) {
  function buildHitResolutionContext(ctx, event) {
    const stats = ctx.query.statsAt(event.at, event, ctx);
    const flatStrike =
      Number.isFinite(event.flatDamage)
      || Number.isFinite(event.flatStrikeBase)
      || Number.isFinite(event.flatStrikePowerCoeff);
    const critical = ctx.query.critical(event, event.at, ctx);
    if (event.noCrit || flatStrike) critical.chance = 0;
    const criticalMultiplier = flatStrike
      ? 1
      : expectedCritMultiplier(
        critical.chance * 100,
        critical.damage * 100,
      );
    const outgoingMultiplier = flatStrike
      ? (() => {
        let multiplier = Number(event.flatStrikeMultiplier ?? 1);
        const maximum = Number(ctx.config.target?.health || 0);
        const threshold = Number(event.flatStrikeHealthThreshold || 0);
        const currentDamage =
          Number(ctx.totals.strike || 0)
          + Number(ctx.totals.condition || 0);
        if (
          maximum > 0
          && threshold > 0
          && currentDamage > maximum * (1 - threshold)
        ) {
          multiplier *= Number(event.flatStrikeThresholdMultiplier ?? 1);
        }
        return multiplier;
      })()
      : (
        ctx.query.strikeMultiplier(event, event.at, ctx)
        * relicStrikeMultiplier(ctx, event)
        * targetHealthMultiplier(ctx, event)
      );
    const baseDamage = flatStrike
      ? (
        Number(event.flatDamage ?? event.flatStrikeBase ?? 0)
        + Number(event.flatStrikePowerCoeff || 0) * stats.power
      )
      : strikeDamage(
        Number(event.coefficient || 0),
        ctx.helpers.weaponStrength(event, ctx.config),
        stats.power,
        Math.max(1, Number(ctx.config.target?.armor || 2597)),
      );

    return {
      stats,
      critical,
      criticalMultiplier,
      outgoingMultiplier,
      baseDamage,
      damage: baseDamage * criticalMultiplier * outgoingMultiplier,
    };
  }

  function applyResolvedHit(ctx, event, hitContext) {
    const damage = hitContext.damage;
    ctx.totals.strike += damage;
    ctx.addBreakdown(
      event.name,
      damage,
      "strikeDamage",
      Number(event.hits || 1),
    );
    if (damage > 0) ctx.markDamageTime(event.at);

    const resolved = {
      ...event,
      damage,
      criticalChance: hitContext.critical.chance,
      criticalDamage: hitContext.critical.damage,
    };
    ctx.resolved.push(resolved);
    return resolved;
  }

  return Object.freeze({
    buildHitResolutionContext,
    applyResolvedHit,
  });
}
