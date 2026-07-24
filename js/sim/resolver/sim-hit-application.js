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
