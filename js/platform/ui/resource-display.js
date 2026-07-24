export function resourceDisplayView(profession, context) {
  const view = profession.ui.resourceView(context);
  if (!view) return null;
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
