/**
 * Produces the ordered, preformatted metric cards consumed by result renderers.
 * Kill time is optional because fixed-horizon simulations may never reach the
 * configured target health.
 */
export function resultSummaryMetrics(result, locale = undefined) {
  const format = value => Math.round(Number(value || 0)).toLocaleString(locale);
  const duration = Number(result.duration);
  const deathTime = result.deathTime == null
    ? null
    : Number(result.deathTime);
  const metrics = deathTime == null
    ? [{
      label: "Duration",
      value: `${duration.toFixed(2)}s`,
      className: "",
    }]
    : [{
      label: "Kill Time",
      value: `${deathTime.toFixed(2)}s`,
      className: "kill-time",
    }];
  metrics.push(
    { label: "Total Damage", value: format(result.totalDamage), className: "" },
    { label: "DPS", value: format(result.dps), className: "dps" },
    { label: "Strike", value: format(result.strikeDamage), className: "" },
    { label: "Condition", value: format(result.conditionDamage), className: "condi" },
  );
  return metrics;
}

/**
 * Returns cumulative average-DPS snapshots when the target reaches each
 * remaining-health milestone. Damage landing at the same timestamp is grouped
 * so resolver event ordering cannot change a snapshot.
 */
export function targetHealthBreakpointSnapshots(
  result,
  targetHealth,
  remainingHealthPercents = [80, 60, 40, 20],
) {
  const health = Number(targetHealth || 0);
  if (!(health > 0)) return [];

  const damageByTime = new Map();
  const addDamage = (at, damage) => {
    const time = Number(at);
    const amount = Number(damage);
    if (!Number.isFinite(time) || !(amount > 0)) return;
    damageByTime.set(time, (damageByTime.get(time) || 0) + amount);
  };

  for (const event of result?.resolvedEvents || []) {
    if (event.type === "condition" && Array.isArray(event.damageTicks)) {
      for (const tick of event.damageTicks) addDamage(tick.at, tick.damage);
    } else if (event.type === "damage") {
      addDamage(event.at, event.damage);
    }
  }

  const milestones = [...new Set(remainingHealthPercents)]
    .map(Number)
    .filter(percent => percent > 0 && percent < 100)
    .sort((left, right) => right - left)
    .map(healthPercent => ({
      healthPercent,
      damageThreshold: health * (1 - healthPercent / 100),
    }));
  const snapshots = [];
  const dpsStartTime = Math.max(
    0,
    Number(result?.dpsStartTime ?? result?.firstHitTime ?? 0),
  );
  let cumulativeDamage = 0;
  let milestoneIndex = 0;

  for (const [at, damage] of [...damageByTime.entries()]
    .sort((left, right) => left[0] - right[0])) {
    cumulativeDamage += damage;
    while (
      milestoneIndex < milestones.length
      && cumulativeDamage >= milestones[milestoneIndex].damageThreshold
    ) {
      const elapsed = Math.max(0, at - dpsStartTime);
      snapshots.push({
        healthPercent: milestones[milestoneIndex].healthPercent,
        at,
        elapsed,
        damage: cumulativeDamage,
        dps: elapsed > 0 ? cumulativeDamage / elapsed : 0,
      });
      milestoneIndex += 1;
    }
    if (milestoneIndex >= milestones.length) break;
  }

  return snapshots;
}
