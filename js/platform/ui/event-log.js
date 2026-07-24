const ORDER = {
  action: 10,
  resource: 30,
  marker: 40,
  proc: 50,
  damage: 60,
  condition: 70,
};

export function eventLogRows(result, adapters = {}) {
  const rows = [];
  for (const event of result?.events || []) {
    const adapter = adapters[event.type];
    const description = adapter?.(event, result)
      ?? (event.type === "action"
        ? `CAST ${event.skillName || event.name || event.sourceId}`
        : event.type === "proc"
          ? `PROC ${event.name || event.sourceId}`
          : null);
    if (!description) continue;
    rows.push({
      at: Number(event.at || 0),
      type: event.type,
      description,
      order: ORDER[event.type] ?? 80,
    });
  }
  return rows
    .sort((left, right) =>
      left.at - right.at
      || left.order - right.order
      || left.description.localeCompare(right.description))
    .map(({ order, ...row }) => row);
}

export function eventLogCsv(rows) {
  const cell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    ["Time (s)", "Type", "Event"].map(cell).join(","),
    ...rows.map(row => [
      Number(row.at || 0).toFixed(3),
      row.type,
      row.description,
    ].map(cell).join(",")),
  ].join("\r\n");
}
