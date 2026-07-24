export function chartValueAt(points, time) {
  if (!points?.length) return 0;
  let value = Number(points[0].v || 0);
  for (const point of points) {
    if (Number(point.t || 0) > time) break;
    value = Number(point.v || 0);
  }
  return value;
}

export function buildChartSeries(
  result,
  sampleStepMs = 250,
  { effectName = value => String(value || ""), stackCaps = {} } = {},
) {
  const durationMs = Math.max(
    1,
    Math.round(Number(result.deathTime ?? result.duration ?? 0) * 1000),
  );
  const interval = Math.max(50, Math.min(1000, Number(sampleStepMs) || 250));
  const times = [];
  for (let time = 0; time < durationMs; time += interval) times.push(time);
  times.push(durationMs);
  const resolved = result.resolvedEvents || [];
  const damageEvents = resolved.filter(event =>
    (event.type === "damage" || event.type === "condition")
    && Number(event.damage || 0) > 0);
  const dpsStartMs = Number(result.dpsStartTime ?? result.firstHitTime ?? 0) * 1000;
  const dps = times.map(time => {
    const elapsed = (time - dpsStartMs) / 1000;
    if (elapsed <= 0) return { t: time, v: 0 };
    let damage = 0;
    for (const event of damageEvents) {
      if (Array.isArray(event.damageTicks)) {
        damage += event.damageTicks
          .filter(tick => Number(tick.at || 0) * 1000 <= time)
          .reduce((sum, tick) => sum + Number(tick.damage || 0), 0);
      } else if (Number(event.at || 0) * 1000 <= time) {
        damage += Number(event.damage || 0);
      }
    }
    return { t: time, v: damage / elapsed };
  });
  const applications = [];
  for (const event of resolved) {
    if (event.type !== "condition") continue;
    const start = Number(event.at || 0) * 1000;
    const end = Number(
      event.expiresAt
      ?? (Number(event.at || 0) + Number(event.effectiveDuration ?? event.duration ?? 0)),
    ) * 1000;
    if (end > start) {
      applications.push({
        name: effectName(event.condition),
        start,
        end,
        stacks: Number(event.stacks || 1),
      });
    }
  }
  for (const event of result.events || []) {
    if (event.type !== "buff" || !Number(event.duration || 0)) continue;
    const start = Number(event.at || 0) * 1000;
    applications.push({
      name: effectName(event.kind),
      start,
      end: start + Number(event.duration) * 1000,
      stacks: Number(event.stacks || 1),
    });
  }
  const effects = {};
  for (const name of new Set(applications.map(entry => entry.name))) {
    const matching = applications.filter(entry => entry.name === name);
    effects[name] = times.map(time => ({
      t: time,
      v: Math.min(
        stackCaps[name] ?? Infinity,
        matching.reduce(
          (sum, entry) =>
            sum + (entry.start <= time && entry.end > time ? entry.stacks : 0),
          0,
        ),
      ),
    }));
  }
  return { durationMs, dps, effects };
}
