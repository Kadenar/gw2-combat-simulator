/**
 * Strike damage resolution: calculates hit damage from coefficient, stats, multipliers.
 * Base strike math in core damage module; profession logic supplies modifiers.
 */
import {
  expectedCritMultiplier,
  strikeDamage,
} from "../../../platform/gw2/damage.js";
import { relicStrikeMultiplier } from "../../../platform/gw2/relic-rules.js";
import { targetHealthMultiplier } from "./damage-modifiers.js";

/**
 * Builds hit resolution context: calculates base damage, crit multiplier, outgoing multiplier.
 * Applies Severance (+250 precision, +250/1500 crit damage).
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Damage event with coefficient, noCrit, at
 * @returns {Object} {stats, critical, criticalMultiplier, outgoingMultiplier, baseDamage, damage (final)}
 */
export function buildHitResolutionContext(ctx, event) {
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

/**
 * Applies a resolved hit: adds damage to totals, records breakdown, marks damage time.
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Damage event
 * @param {Object} hitContext - Hit resolution context with damage, critical
 * @returns {Object} Resolved hit with damage, criticalChance, criticalDamage
 */
export function applyResolvedHit(ctx, event, hitContext) {
  const damage = hitContext.damage;
  ctx.totals.strike += damage;
  ctx.addBreakdown(event.name, damage, "strikeDamage", Number(event.hits || 1));
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
