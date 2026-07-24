/**
 * Strike damage resolution: calculates hit damage from coefficient, stats, multipliers.
 * Base strike math in core damage module; profession logic supplies modifiers.
 */
import {
  expectedCritMultiplier,
  strikeDamage,
} from "../../core/damage.js";
import { relicStrikeMultiplier } from "../mechanics/sim-relic-rules.js";

/**
 * Calculates Egotism multiplier: +10% damage while target > 50% health, else 1.
 * @param {Object} ctx - Resolver context with config.target.health, totals.strike/condition
 * @returns {number} Multiplier (1 or 1.1)
 */
export function targetHealthMultiplier(ctx) {
  if (!ctx.traits.has("Egotism")) return 1;
  const targetHealth = Number(ctx.config.target?.health || 0);
  if (!(targetHealth > 0)) return 1;
  return ctx.totals.strike + ctx.totals.condition < targetHealth * 0.5
    ? 1.1
    : 1;
}

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
