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
    const stats = ctx.query.statsAt(event.at);
    const critical = ctx.query.critical(event, event.at);
    if (ctx.sigil.severanceUntil > event.at) {
      critical.chance = Math.min(1, critical.chance + 250 / 2100);
      critical.damage += 250 / 1500;
    }
    if (event.noCrit) critical.chance = 0;
    const criticalMultiplier = expectedCritMultiplier(
      critical.chance * 100,
      critical.damage * 100,
    );
    const outgoingMultiplier =
      ctx.query.strikeMultiplier(event, event.at)
      * relicStrikeMultiplier(ctx, event)
      * targetHealthMultiplier(ctx);
    const strength = ctx.helpers.weaponStrength(event, ctx.config);
    const armor = Math.max(1, Number(ctx.config.target?.armor || 2597));
    const baseDamage = strikeDamage(
      Number(event.coefficient || 0),
      strength,
      stats.power,
      armor,
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
    ctx.markDamageTime(event.at);

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
