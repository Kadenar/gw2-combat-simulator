import type {
  ProfessionResourceView,
  SchedulerRecord,
} from "../engine/types.js";
import type { ProfessionAppContract } from "../../app/profession/types.js";

function normalizeResourceView(
  view: ProfessionResourceView,
): ProfessionResourceView {
  const maximum = Math.max(0, Number(view.maximum || 0));
  const displayMode =
    typeof view.displayMode === "string" &&
    ["bar", "counter", "pips"].includes(view.displayMode)
      ? view.displayMode
      : maximum > 20
        ? "bar"
        : "pips";
  const value = Math.max(0, Math.min(maximum, Number(view.value || 0)));
  const pipStyle = String(view.pipStyle || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  const statusItems = Array.isArray(view.statusItems)
    ? view.statusItems.map((item) => ({
        id: String(item.id || item.label || "status"),
        label: String(item.label || item.id || "Status"),
        valueLabel: String(item.valueLabel || ""),
        title: String(item.title || ""),
      }))
    : [];
  return {
    id: String(view.id || "resource"),
    singular: String(view.singular || "resource"),
    plural: String(view.plural || `${view.singular || "resource"}s`),
    maximum,
    value: displayMode === "pips" ? Math.floor(value) : value,
    startMaximum: Math.max(0, Number(view.startMaximum ?? maximum)),
    startValue: Math.max(0, Number(view.startValue ?? view.value ?? 0)),
    canStart: view.canStart !== false,
    buildKey: String(view.buildKey || "initialResource"),
    step: Math.max(0.01, Number(view.step || 1)),
    // Dense resources default to a bar; small discrete resources use pips.
    displayMode,
    barSegments: Math.max(
      1,
      Math.min(maximum || 1, Math.round(Number(view.barSegments || 1))),
    ),
    pipStyle,
    pipRows: Math.max(
      1,
      Math.min(maximum || 1, Math.round(Number(view.pipRows || 1))),
    ),
    shortLabel: String(view.shortLabel || view.singular || "Res"),
    statusLabel: String(view.statusLabel || "Current"),
    statusItemsLabel: String(view.statusItemsLabel || ""),
    statusItems,
    showInPalette: view.showInPalette !== false,
    showValue: view.showValue !== false,
    ...(view.paletteSkillId != null
      ? { paletteSkillId: view.paletteSkillId }
      : {}),
  };
}

export function resourceDisplayViews(
  profession: ProfessionAppContract,
  context: SchedulerRecord,
): ProfessionResourceView[] {
  // resourceViews is the multi-resource contract. resourceView is retained as a
  // compatibility fallback for professions exposing a single mechanic.
  const views = profession.ui.resourceViews
    ? profession.ui.resourceViews(context)
    : [profession.ui.resourceView(context)].filter(
        (view): view is ProfessionResourceView => view != null,
      );
  if (!Array.isArray(views)) {
    throw new TypeError("Profession resourceViews must return an array.");
  }
  return views
    .filter((view): view is ProfessionResourceView => view != null)
    .map(normalizeResourceView);
}

export function resourceDisplayView(
  profession: ProfessionAppContract,
  context: SchedulerRecord,
): ProfessionResourceView | null {
  // Singular callers intentionally receive the first declared resource.
  return resourceDisplayViews(profession, context)[0] || null;
}
