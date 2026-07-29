function normalizeResourceView(view) {
  const maximum = Math.max(0, Number(view.maximum || 0));
  const displayMode = ["bar", "pips"].includes(view.displayMode)
    ? view.displayMode
    : maximum > 20 ? "bar" : "pips";
  const value = Math.max(
    0,
    Math.min(maximum, Number(view.value || 0)),
  );
  const pipStyle = String(view.pipStyle || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  return {
    id: String(view.id || "resource"),
    singular: String(view.singular || "resource"),
    plural: String(view.plural || `${view.singular || "resource"}s`),
    maximum,
    value: displayMode === "pips" ? Math.floor(value) : value,
    startMaximum: Math.max(
      0,
      Number(view.startMaximum ?? maximum),
    ),
    startValue: Math.max(
      0,
      Number(view.startValue ?? view.value ?? 0),
    ),
    canStart: view.canStart !== false,
    buildKey: String(view.buildKey || "initialResource"),
    step: Math.max(0.01, Number(view.step || 1)),
    // Dense resources default to a bar; small discrete resources use pips.
    displayMode,
    pipStyle,
    pipRows: Math.max(
      1,
      Math.min(maximum || 1, Math.round(Number(view.pipRows || 1))),
    ),
    shortLabel: String(view.shortLabel || view.singular || "Res"),
    statusLabel: String(view.statusLabel || "Current"),
  };
}

export function resourceDisplayViews(profession, context) {
  // resourceViews is the multi-resource contract. resourceView is retained as a
  // compatibility fallback for professions exposing a single mechanic.
  const views = profession.ui.resourceViews
    ? profession.ui.resourceViews(context)
    : [profession.ui.resourceView(context)].filter(Boolean);
  if (!Array.isArray(views)) {
    throw new TypeError("Profession resourceViews must return an array.");
  }
  return views.filter(Boolean).map(normalizeResourceView);
}

export function resourceDisplayView(profession, context) {
  // Singular callers intentionally receive the first declared resource.
  return resourceDisplayViews(profession, context)[0] || null;
}
