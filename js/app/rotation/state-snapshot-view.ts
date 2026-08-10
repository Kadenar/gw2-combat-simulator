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
import type {
  RotationStateSnapshotItem,
  SimulationEvent,
} from "../../platform/engine/types.js";
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
    // Skip strikes that cannot crit (food/sigil flat ticks, tethers, other
    // noCrit/canCrit:false hits). Their crit chance is forced to 0, so counting
    // them would misreport the player's crit chance as 0% whenever such a tick
    // is the strike nearest the inspection point.
    if (event.critEligible === false) continue;
    const chance = Number(event.criticalChance);
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

/**
 * The latest timed self-buff of `kind` still active at `atSeconds`, read from
 * the simulation's own buff timeline (`result.events`, type `"buff"`). This is
 * the same source the damage-modifier rules gate on, so a timer derived from it
 * always matches what is actually buffing the player — no parallel state field
 * to keep in sync. Returns the remaining seconds and the source event (for
 * callers that need extra fields on it, e.g. a weapon tag), or `null` when no
 * such buff is active.
 *
 * Shared so any profession's `rotationStateSnapshot` slice can surface a buff
 * timer without re-implementing the scan. See ROTATION_STATE_SNAPSHOT.md.
 */
export function timedBuffAt(
  result: Gw2SimulationResult | null | undefined,
  kind: string,
  atSeconds: number,
): { readonly remaining: number; readonly event: SimulationEvent } | null {
  const at = Math.max(0, Number(atSeconds || 0));
  // result.events is ordered by `at`; the last buff of this kind at/before the
  // point is the one in effect (later casts of the same buff supersede earlier).
  let latest: SimulationEvent | null = null;
  for (const event of result?.events || []) {
    if (Number(event.at || 0) > at) break;
    if (event.type === "buff" && event.kind === kind) latest = event;
  }
  if (!latest) return null;
  const remaining = Number(latest.at || 0) + Number(latest.duration || 0) - at;
  return remaining > 0 ? { remaining, event: latest } : null;
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
