/**
 * Renders the sticky "active state" bar above the rotation timeline.
 *
 * The bar reports inspectable values at a single point in the rotation: the end
 * of the rotation by default, or the insertion cursor when one is set. It reuses
 * the same insertion-aware end state as the palette cooldown display
 * (`paletteEndState`), so it costs no extra simulation.
 *
 * Two kinds of items are shown:
 * - Generic, profession-neutral values computed here (critical strike chance,
 *   read from the nearest resolved strike).
 * - Cherry-picked profession/spec timers contributed by the active profession
 *   through `ui.rotationStateSnapshot` (e.g. Berserk, Magebane Tether,
 *   Overcharged Cartridges).
 */
import { activeSpecialization, paletteEndState } from "./context.js";
import { formatResultTimelineTime } from "./result-model.js";
import { escapeHtml as esc } from "../../platform/ui/html.js";
import type { Gw2SimulationResult } from "../../platform/gw2/types.js";
import type { RotationStateSnapshotItem } from "../../platform/engine/types.js";
import type { ProfessionAppState } from "../profession/types.js";

/**
 * Player critical-strike chance (0..1) at a point in the rotation, taken from
 * the actual resolved strike nearest to `timeMs` — preferring the next strike
 * at/after the point, otherwise the most recent one before it. Summon and
 * illusion strikes are excluded so the value reflects the player. Returns `null`
 * when the rotation has no player strikes.
 */
export function criticalChanceAt(
  result: Gw2SimulationResult | null | undefined,
  timeMs: number,
): number | null {
  const seconds = Number(timeMs || 0) / 1000;
  let after: number | null = null;
  let afterAt = Infinity;
  let before: number | null = null;
  let beforeAt = -Infinity;
  for (const event of result?.resolvedEvents || []) {
    if (event.independentSummonStrike === true) continue;
    if (event.source === "Clone" || event.source === "Phantasm") continue;
    const chance = Number((event as { criticalChance?: number }).criticalChance);
    if (!Number.isFinite(chance)) continue;
    const at = Number(event.at || 0);
    if (at >= seconds) {
      if (at < afterAt) {
        afterAt = at;
        after = chance;
      }
    } else if (at > beforeAt) {
      beforeAt = at;
      before = chance;
    }
  }
  return after ?? before;
}

function snapshotItems(app: ProfessionAppState): {
  readonly items: RotationStateSnapshotItem[];
  readonly atInsertion: boolean;
  readonly timeMs: number;
} {
  const result = app.results;
  const state = paletteEndState(app);
  const timeMs = Number(state?.time || 0);
  const rotationLength = app.build.rotation.length;
  const atInsertion =
    app.rotationInsertionIndex != null &&
    app.rotationInsertionIndex !== rotationLength;

  const items: RotationStateSnapshotItem[] = [];
  const critical = criticalChanceAt(result, timeMs);
  if (critical != null) {
    items.push({
      id: "critical-chance",
      label: "Crit chance",
      value: `${Math.round(critical * 100)}%`,
      title: atInsertion
        ? "Critical strike chance of the next strike at the insertion point"
        : "Critical strike chance of the last strike in the rotation",
    });
  }
  items.push(
    ...app.profession.ui.rotationStateSnapshot({
      specialization: activeSpecialization(app),
      professionState: state?.profession,
      atSeconds: timeMs / 1000,
      build: app.build,
      result,
    }),
  );
  return { items, atInsertion, timeMs };
}

/**
 * Fills `#rotation-active-buffs` with the current state snapshot, or hides it
 * when there is nothing to show (no results yet, empty rotation, or no active
 * values).
 */
export function renderRotationStateSnapshot(app: ProfessionAppState): void {
  const element = document.getElementById("rotation-active-buffs");
  if (!element) return;
  if (!app.results || !app.build.rotation.length) {
    element.innerHTML = "";
    element.hidden = true;
    return;
  }
  const { items, atInsertion, timeMs } = snapshotItems(app);
  const visible = items.filter((item) => item.active !== false);
  if (!visible.length) {
    element.innerHTML = "";
    element.hidden = true;
    return;
  }
  element.hidden = false;
  // The snapshot always reflects a point in time: the insertion cursor when one
  // is set, otherwise the current end of the rotation. Label it by that time so
  // it reads as "state at this moment", matching the timeline's own timestamps.
  const time = formatResultTimelineTime(timeMs, app.results);
  const label = atInsertion
    ? `Active state @ ${time} (insertion point)`
    : `Active state @ ${time}`;
  element.innerHTML =
    `<span class="rot-state-label">${esc(label)}:</span>` +
    visible
      .map(
        (item) =>
          `<span class="rot-state-item"${
            item.title ? ` title="${esc(item.title)}"` : ""
          }>${esc(item.label)} <strong>${esc(item.value)}</strong></span>`,
      )
      .join("");
}
