const baseName = name => String(name || "").split("—")[0].trim();

export function skillBreakdownRows(result) {
  const actionDurations = new Map();
  const actionCounts = new Map();
  for (const event of result.events || []) {
    if (event.type !== "action") continue;
    const name = event.skillName || event.name || String(event.sourceId);
    actionDurations.set(
      name,
      (actionDurations.get(name) || 0)
        + Math.max(0, Number(event.endsAt || event.at) - Number(event.at || 0)),
    );
    actionCounts.set(name, (actionCounts.get(name) || 0) + 1);
  }
  const resolvedByName = new Map();
  for (const event of result.resolvedEvents || []) {
    if (!resolvedByName.has(event.name)) resolvedByName.set(event.name, event);
  }
  const grouped = new Map();
  for (const entry of result.breakdown || []) {
    const sourceEvent = resolvedByName.get(entry.name);
    const sourceSkill =
      entry.sourceSkill
      || sourceEvent?.skillName
      || baseName(entry.name);
    const current = grouped.get(sourceSkill) || {
      name: sourceSkill,
      sourceSkill,
      strike: 0,
      condition: 0,
      hits: 0,
      fallbackCasts: 0,
    };
    current.strike += Number(entry.strikeDamage || 0);
    current.condition += Number(entry.conditionDamage || 0);
    current.hits += Number(entry.hits || 0);
    current.fallbackCasts = Math.max(current.fallbackCasts, Number(entry.casts || 0));
    grouped.set(sourceSkill, current);
  }
  return [...grouped.values()].map(entry => {
    const casts = Number(actionCounts.get(entry.sourceSkill) ?? entry.fallbackCasts);
    const total = entry.strike + entry.condition;
    const castTime = Number(actionDurations.get(entry.sourceSkill) || 0);
    return {
      ...entry,
      total,
      dps: total / Math.max(0.001, Number(result.dpsWindow ?? result.duration ?? 0)),
      average: casts > 0 ? total / casts : null,
      dct: castTime > 0 ? total / castTime : null,
      casts,
    };
  }).filter(row => row.total > 0).sort((left, right) => right.total - left.total);
}
