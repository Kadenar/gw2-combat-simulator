/**
 * Produces the ordered, preformatted metric cards consumed by result renderers.
 * Kill time is optional because fixed-horizon simulations may never reach the
 * configured target health.
 */
export function resultSummaryMetrics(result, locale = undefined) {
  const format = value => Math.round(Number(value || 0)).toLocaleString(locale);
  const metrics = [
    { label: "Duration", value: `${Number(result.duration).toFixed(2)}s`, className: "" },
  ];
  if (result.deathTime != null) {
    metrics.push({
      label: "Kill Time",
      value: `${Number(result.deathTime).toFixed(2)}s`,
      className: "kill-time",
    });
  }
  metrics.push(
    { label: "Total Damage", value: format(result.totalDamage), className: "" },
    { label: "DPS", value: format(result.dps), className: "dps" },
    { label: "Strike", value: format(result.strikeDamage), className: "" },
    { label: "Condition", value: format(result.conditionDamage), className: "condi" },
  );
  return metrics;
}
