import type {
  LegacyRotationItem,
  SchedulerRecord,
  SchedulerStep,
  SimulationEvent,
} from "../engine/types.js";
import type { Gw2SimulationResult } from "../gw2/types.js";
import type { RotationDragState, TimelineInteractionOptions } from "./types.js";

export type TimelineRotationEntry = LegacyRotationItem | SchedulerRecord;

export interface TimelineCastOrdinal {
  readonly matchingIndex: number;
  readonly matchingTotal: number;
  readonly skillIndex: number;
  readonly skillTotal: number;
}

export interface TimelineRow {
  readonly weaponSet: number;
  readonly weaponLine: string | null;
  readonly skills: Array<{
    readonly entry: TimelineRotationEntry;
    readonly index: number;
  }>;
}

export interface EventTimelineMarker {
  readonly insertionIndex: number;
  readonly skill: string | undefined;
  readonly start: number;
  readonly detail: string | undefined;
}

export function clearTimelineDropIndicators(
  root: HTMLElement | null | undefined,
): void {
  if (!root) return;
  root.classList.remove(
    "drag-over",
    "drag-over-empty",
    "drag-insert-before",
    "drag-insert-after",
  );
  root
    .querySelectorAll<HTMLElement>(
      ".drag-over, .drag-over-empty, .drag-insert-before, .drag-insert-after",
    )
    .forEach((element) =>
      element.classList.remove(
        "drag-over",
        "drag-over-empty",
        "drag-insert-before",
        "drag-insert-after",
      ),
    );
}

export function formatTimelineCastDetails(
  step: SchedulerStep | null | undefined,
  formatTime: (time: number) => string,
): string {
  const start = Number(step?.start);
  const end = Number(step?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "";
  const castSeconds = Math.max(0, end - start) / 1000;
  return `Cast: ${formatTime(start)} → ${formatTime(end)}\nCast time: ${castSeconds.toFixed(2)}s`;
}

const NON_SKILL_STEP_NAMES = new Set(["Wait", "Combat Start"]);

export function timelineSkillCastOrdinals(
  steps: readonly SchedulerStep[] = [],
): Map<number, TimelineCastOrdinal> {
  const casts = steps
    .filter(
      (step) =>
        Number.isInteger(Number(step?.ri)) &&
        !step.invalid &&
        !NON_SKILL_STEP_NAMES.has(String(step.skill || "")),
    )
    .sort(
      (left, right) =>
        Number(left.start || 0) - Number(right.start || 0) ||
        Number(left.ri) - Number(right.ri),
    );
  const totalsBySkill = new Map<string, number>();
  for (const cast of casts) {
    totalsBySkill.set(cast.skill, (totalsBySkill.get(cast.skill) || 0) + 1);
  }
  const seenBySkill = new Map<string, number>();
  return new Map(
    casts.map((cast, index) => {
      const matchingIndex = (seenBySkill.get(cast.skill) || 0) + 1;
      seenBySkill.set(cast.skill, matchingIndex);
      return [
        Number(cast.ri),
        {
          matchingIndex,
          matchingTotal: totalsBySkill.get(cast.skill) ?? 0,
          skillIndex: index + 1,
          skillTotal: casts.length,
        },
      ];
    }),
  );
}

export function formatTimelineSkillTooltip(
  name: unknown,
  step: SchedulerStep | null | undefined,
  ordinal: TimelineCastOrdinal | null | undefined,
  formatTime: (time: number) => string,
): string {
  if (!step || step.invalid || !ordinal) return String(name || "");
  const duration = Math.max(
    0,
    Math.round(Number(step.end || 0) - Number(step.start || 0)),
  );
  return [
    `${name} at ${formatTime(step.start)} for ${duration}ms`,
    `${name} cast ${ordinal.matchingIndex} of ${ordinal.matchingTotal}`,
    `Skill cast ${ordinal.skillIndex} of ${ordinal.skillTotal}`,
  ].join("\n");
}

export function formatConcurrentTimelineBadge(
  offsetMs: unknown,
  timestamp: unknown = "",
): string {
  const time = String(timestamp || "").trim();
  return `⊙${Number(offsetMs)}ms${time ? `\n${time}` : ""}`;
}

export function formatInterruptTimelineBadge(
  interruptMs: unknown,
  timestamp: unknown = "",
): string {
  const time = String(timestamp || "").trim();
  return `✂${Number(interruptMs)}ms${time ? `\n${time}` : ""}`;
}

export function getSkillDropInsertionIndex(
  skillElement: HTMLElement,
  clientX: number,
): number | null {
  const rawIndex = skillElement?.dataset?.idx;
  if (rawIndex == null || String(rawIndex).trim() === "") return null;
  const index = Number(rawIndex);
  if (!Number.isInteger(index)) return null;
  const rect = skillElement.getBoundingClientRect();
  // Dropping on the left/right half inserts before/after the hovered entry.
  return clientX < rect.left + rect.width / 2 ? index : index + 1;
}

export function updateSkillDropIndicator(
  skillElement: HTMLElement,
  clientX: number,
): void {
  skillElement.classList.remove("drag-insert-before", "drag-insert-after");
  const rect = skillElement.getBoundingClientRect();
  skillElement.classList.add(
    clientX < rect.left + rect.width / 2
      ? "drag-insert-before"
      : "drag-insert-after",
  );
}

export function moveRotationEntry(
  rotation: TimelineRotationEntry[],
  fromIndex: number,
  toIndex: number,
): boolean {
  if (
    !Array.isArray(rotation) ||
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    fromIndex >= rotation.length
  ) {
    return false;
  }

  const boundedTarget = Math.max(0, Math.min(toIndex, rotation.length));
  // Removing an earlier entry shifts a forward insertion target left by one.
  const insertAt =
    fromIndex < boundedTarget ? boundedTarget - 1 : boundedTarget;
  if (insertAt === fromIndex) return false;

  const [entry] = rotation.splice(fromIndex, 1);
  if (entry === undefined) return false;
  rotation.splice(insertAt, 0, entry);
  return true;
}

export function rotationEntryName(entry: TimelineRotationEntry): string {
  return entry && typeof entry === "object"
    ? String(entry.name || "")
    : String(entry || "");
}

export function updateRotationEntry(
  entry: TimelineRotationEntry,
  changes: SchedulerRecord = {},
): TimelineRotationEntry {
  // Promote a primitive to an object only while it carries additional options.
  const updated: SchedulerRecord =
    entry && typeof entry === "object"
      ? { ...entry }
      : { name: String(entry || "") };
  for (const [key, value] of Object.entries(changes || {})) {
    if (key === "name") {
      updated.name = String(value || "");
    } else if (value === undefined) {
      delete updated[key];
    } else {
      updated[key] = value;
    }
  }
  const keys = Object.keys(updated);
  // Compact back to a primitive after the last option is removed.
  if (keys.length === 1 && keys[0] === "name") {
    return typeof updated.name === "number"
      ? updated.name
      : String(updated.name || "");
  }
  return updated;
}

export function removeRotationEntryOptions(
  entry: TimelineRotationEntry,
  keys: readonly string[] = [],
): TimelineRotationEntry {
  return updateRotationEntry(
    entry,
    Object.fromEntries(keys.map((key) => [key, undefined])),
  );
}

export function insertRotationEntry(
  rotation: TimelineRotationEntry[],
  entry: TimelineRotationEntry | null | undefined,
  index: number,
): boolean {
  if (!Array.isArray(rotation) || entry == null || !Number.isInteger(index)) {
    return false;
  }
  const boundedIndex = Math.max(0, Math.min(index, rotation.length));
  rotation.splice(boundedIndex, 0, entry);
  return true;
}

export function insertRotationEntries(
  rotation: TimelineRotationEntry[],
  entries: TimelineRotationEntry[],
  index: number,
): boolean {
  if (
    !Array.isArray(rotation) ||
    !Array.isArray(entries) ||
    !entries.length ||
    entries.some((entry) => entry == null) ||
    !Number.isInteger(index)
  ) {
    return false;
  }
  const boundedIndex = Math.max(0, Math.min(index, rotation.length));
  rotation.splice(boundedIndex, 0, ...entries);
  return true;
}

export function timelineRows(
  rotation: readonly TimelineRotationEntry[] = [],
  {
    startingWeaponSet = 1,
    isWeaponSwap = () => false,
    isWeaponSetRefresh = () => false,
    weaponLineTransition = () => undefined,
  }: {
    readonly startingWeaponSet?: number;
    readonly isWeaponSwap?: (entry: TimelineRotationEntry) => boolean;
    readonly isWeaponSetRefresh?: (entry: TimelineRotationEntry) => boolean;
    readonly weaponLineTransition?: (
      entry: TimelineRotationEntry,
      current: { weaponSet: number; weaponLine: string | null },
    ) => string | null | undefined;
  } = {},
): TimelineRow[] {
  const rows: TimelineRow[] = [
    {
      weaponSet: startingWeaponSet,
      weaponLine: null,
      skills: [],
    },
  ];
  let weaponSet = startingWeaponSet;
  let weaponLine: string | null = null;
  rotation.forEach((entry, index) => {
    rows.at(-1)?.skills.push({ entry, index });
    const swapsWeaponSet = isWeaponSwap(entry);
    const nextWeaponLine = weaponLineTransition(entry, {
      weaponSet,
      weaponLine,
    });
    const changesWeaponLine = nextWeaponLine !== undefined;
    if (!swapsWeaponSet && !isWeaponSetRefresh(entry) && !changesWeaponLine)
      return;
    // A real swap changes the next row's set. Transform transitions start a
    // fresh row for the same equipped set.
    if (swapsWeaponSet) weaponSet = weaponSet === 1 ? 2 : 1;
    if (changesWeaponLine) weaponLine = nextWeaponLine;
    if (index < rotation.length - 1) {
      rows.push({ weaponSet, weaponLine, skills: [] });
    }
  });
  return rows;
}

export function eventTimelineMarkers(
  result: Gw2SimulationResult | null | undefined,
  rotationLength: number,
  predicate: (event: SimulationEvent) => boolean = (event) =>
    event.type === "marker",
): EventTimelineMarker[] {
  const steps = (result?.steps || [])
    .filter((step) => step.ri >= 0 && !step.invalid)
    .sort((left, right) => left.start - right.start || left.ri - right.ri);
  return (result?.events || [])
    .filter(predicate)
    .map((event) => {
      const start = Math.round(Number(event.at || 0) * 1000);
      // Inject the marker immediately before the first rotation step that has
      // not started; events after all steps append to the timeline.
      const next = steps.find((step) => step.start >= start);
      return {
        insertionIndex: next?.ri ?? rotationLength,
        skill: event.name,
        start,
        detail: event.detail,
      };
    })
    .sort((left, right) => left.start - right.start);
}

/**
 * Binds interaction behavior to rendered timeline markup.
 */
export function bindTimelineInteractions(
  root: HTMLElement | null | undefined,
  options: TimelineInteractionOptions,
):
  | {
      readonly applyDrop: (insertAt: number) => boolean;
      readonly cleanup: (element: HTMLElement | null | undefined) => void;
    }
  | undefined {
  if (!root) return;
  // Interaction helpers mutate the caller-owned rotation in place, then use
  // onChanged as the single rerender/persistence notification.
  const rotation = options.rotation || [];
  const getDragState = options.getDragState || (() => null);
  const setDragState = options.setDragState || (() => {});
  const changed = (): void => {
    options.onChanged?.();
  };

  const applyDrop = (insertAt: number): boolean => {
    const drag = getDragState();
    if (!drag) return false;
    setDragState(null);
    if (drag.source === "timeline") {
      const fromIndex = Number(drag.index ?? drag.idx);
      if (!moveRotationEntry(rotation, fromIndex, insertAt)) return false;
      changed();
      return true;
    }
    if (drag.source === "palette") {
      const name = String(drag.name ?? drag.skillName ?? "");
      const resolved = options.resolvePaletteEntry?.(name, drag);
      // Palette macros may resolve to multiple adjacent entries.
      const inserted = Array.isArray(resolved)
        ? insertRotationEntries(rotation, resolved, insertAt)
        : insertRotationEntry(rotation, resolved, insertAt);
      if (!inserted) return false;
      changed();
      return true;
    }
    return false;
  };

  const cleanup = (element: HTMLElement | null | undefined): void => {
    element?.classList?.remove("dragging");
    setDragState(null);
    clearTimelineDropIndicators(root);
  };

  for (const item of root.querySelectorAll<HTMLElement>(
    ".rot-skill[data-idx]:not(.rot-injected)",
  )) {
    const index = Number(item.dataset.idx);
    const remove = item.querySelector<HTMLElement>(".rot-x");
    if (remove) {
      remove.setAttribute("draggable", "false");
      remove.onmousedown = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };
      remove.ondragstart = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };
      remove.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!Number.isInteger(index)) return;
        if (event.shiftKey) {
          // Shift-remove is the fast "truncate rotation here" gesture.
          if (options.onTruncate) options.onTruncate(index);
          else rotation.splice(index);
        } else if (options.onRemove) {
          options.onRemove(index);
        } else {
          rotation.splice(index, 1);
        }
        changed();
      };
    }
    item.ondragstart = (event) => {
      if (!Number.isInteger(index)) {
        event.preventDefault();
        return;
      }
      setDragState({ source: "timeline", index });
      item.classList.add("dragging");
      event.dataTransfer?.setData("text/plain", String(index));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    };
    item.ondragend = () => cleanup(item);
    item.ondragover = (event) => {
      if (!getDragState()) return;
      event.preventDefault();
      clearTimelineDropIndicators(root);
      updateSkillDropIndicator(item, event.clientX);
    };
    item.ondragleave = () => {
      item.classList.remove("drag-insert-before", "drag-insert-after");
    };
    item.ondrop = (event) => {
      if (!getDragState()) return;
      event.preventDefault();
      event.stopPropagation();
      const insertAt = getSkillDropInsertionIndex(item, event.clientX);
      clearTimelineDropIndicators(root);
      if (insertAt != null) applyDrop(insertAt);
    };
  }

  for (const row of root.querySelectorAll<HTMLElement>(
    ".rot-row:not(.rot-procs-row) > .rot-row-skills",
  )) {
    row.ondragover = (event) => {
      // Skill elements own midpoint insertion. Row background drops use the
      // row's precomputed insertion boundary.
      const target = event.target instanceof Element ? event.target : null;
      if (!getDragState() || target?.closest(".rot-skill")) return;
      event.preventDefault();
      clearTimelineDropIndicators(root);
      row.classList.add("drag-over");
    };
    row.ondragleave = (event) => {
      if (event.target === row) row.classList.remove("drag-over");
    };
    row.ondrop = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!getDragState() || target?.closest(".rot-skill")) return;
      event.preventDefault();
      event.stopPropagation();
      const insertAt = Number(row.dataset.insertIdx);
      clearTimelineDropIndicators(root);
      if (Number.isInteger(insertAt)) applyDrop(insertAt);
    };
  }

  root.ondragover = (event) => {
    // The root is the empty-space fallback and always appends.
    const target = event.target instanceof Element ? event.target : null;
    if (!getDragState() || target?.closest(".rot-row-skills")) return;
    event.preventDefault();
    clearTimelineDropIndicators(root);
    root.classList.add("drag-over-empty");
  };
  root.ondragleave = (event) => {
    if (event.target === root) root.classList.remove("drag-over-empty");
  };
  root.ondrop = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!getDragState() || target?.closest(".rot-row-skills")) return;
    event.preventDefault();
    clearTimelineDropIndicators(root);
    applyDrop(rotation.length);
  };

  const bindEdit = (
    selector: string,
    callback: ((index: number, event?: Event) => unknown) | undefined,
  ): void => {
    for (const badge of root.querySelectorAll<HTMLElement>(selector)) {
      badge.onclick = (event) => {
        event.stopPropagation();
        const index = Number(badge.dataset.idx);
        if (!Number.isInteger(index)) return;
        // Returning false means the editor cancelled and no rerender is needed.
        if (callback?.(index, event) !== false) changed();
      };
    }
  };
  bindEdit(".rot-offset-badge", options.onEditOffset);
  bindEdit(".rot-interrupt-badge", options.onEditInterrupt);
  bindEdit(".rot-wait-badge", options.onEditWait);

  return { applyDrop, cleanup };
}
