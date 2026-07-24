function normalizeResourceView(view) {
  const maximum = Math.max(0, Number(view.maximum || 0));
  return {
    id: String(view.id || "resource"),
    singular: String(view.singular || "resource"),
    plural: String(view.plural || `${view.singular || "resource"}s`),
    maximum,
    value: Math.max(0, Math.min(maximum, Number(view.value || 0))),
    canStart: view.canStart !== false,
    shortLabel: String(view.shortLabel || view.singular || "Res"),
    statusLabel: String(view.statusLabel || "Current"),
  };
}

export function resourceDisplayViews(profession, context) {
  const views = profession.ui.resourceViews
    ? profession.ui.resourceViews(context)
    : [profession.ui.resourceView(context)].filter(Boolean);
  if (!Array.isArray(views)) {
    throw new TypeError("Profession resourceViews must return an array.");
  }
  return views.filter(Boolean).map(normalizeResourceView);
}

export function resourceDisplayView(profession, context) {
  return resourceDisplayViews(profession, context)[0] || null;
}
