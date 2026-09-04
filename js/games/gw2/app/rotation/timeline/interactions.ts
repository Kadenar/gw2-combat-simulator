import type { RotationCommand, SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

export interface RotationDragState extends SchedulerRecord {
  readonly source?: string;
  readonly index?: number;
  readonly name?: string;
  readonly skillId?: SkillId;
}

export interface TimelineInteractionOptions {
  readonly rotation: RotationCommand[];
  readonly getDragState: () => RotationDragState | null | undefined;
  readonly setDragState: (value: RotationDragState | null) => void;
  /** Applies a timeline drag through the application-owned rotation editing layer. */
  readonly moveEntry: (fromIndex: number, toIndex: number) => boolean;
  /** Applies one resolved palette item or macro through the application-owned editing layer. */
  readonly insertEntries: (entries: readonly RotationCommand[], insertAt: number) => boolean;
  readonly resolvePaletteEntry?: (
    name: string,
    drag: RotationDragState | null | undefined,
    insertAt: number
  ) => RotationCommand | RotationCommand[] | null | undefined;
  readonly onChanged?: () => void;
  readonly onRemove?: (index: number, event?: Event) => unknown;
  readonly onTruncate?: (index: number, event?: Event) => unknown;
  readonly onEditActivation?: (index: number, event?: Event) => unknown;
  readonly onEditInterrupt?: (index: number, event?: Event) => unknown;
  readonly onEditReleaseAtCharges?: (index: number, event?: Event) => unknown;
  readonly onEditDoubleEdgeOutcome?: (index: number, event?: Event) => unknown;
  readonly onEditWait?: (index: number, event?: Event) => unknown;
}

export function clearTimelineDropIndicators(root: HTMLElement | null | undefined): void {
  if (!root) return;
  root.classList.remove('drag-over', 'drag-over-empty', 'drag-insert-before', 'drag-insert-after');
  root
    .querySelectorAll<HTMLElement>('.drag-over, .drag-over-empty, .drag-insert-before, .drag-insert-after')
    .forEach((element) =>
      element.classList.remove('drag-over', 'drag-over-empty', 'drag-insert-before', 'drag-insert-after')
    );
}

export function getSkillDropInsertionIndex(skillElement: HTMLElement, clientX: number): number | null {
  const rawIndex = skillElement?.dataset?.idx;
  if (rawIndex == null || String(rawIndex).trim() === '') return null;
  const index = Number(rawIndex);
  if (!Number.isInteger(index)) return null;
  const rect = skillElement.getBoundingClientRect();
  // Dropping on the left/right half inserts before/after the hovered entry.
  return clientX < rect.left + rect.width / 2 ? index : index + 1;
}

export function updateSkillDropIndicator(skillElement: HTMLElement, clientX: number): void {
  skillElement.classList.remove('drag-insert-before', 'drag-insert-after');
  const rect = skillElement.getBoundingClientRect();
  skillElement.classList.add(clientX < rect.left + rect.width / 2 ? 'drag-insert-before' : 'drag-insert-after');
}

/** Binds timeline drag, drop, removal, and editor controls to rendered entries. */
export function bindTimelineInteractions(
  root: HTMLElement | null | undefined,
  options: TimelineInteractionOptions
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
    if (drag.source === 'timeline') {
      const fromIndex = Number(drag.index ?? drag.idx);
      if (!options.moveEntry(fromIndex, insertAt)) return false;
      changed();
      return true;
    }

    if (drag.source === 'palette') {
      const name = String(drag.name ?? drag.skillName ?? '');
      const resolved = options.resolvePaletteEntry?.(name, drag, insertAt);
      // Palette macros may resolve to multiple adjacent entries.
      const entries = Array.isArray(resolved) ? resolved : resolved ? [resolved] : [];
      if (!options.insertEntries(entries, insertAt)) return false;
      changed();
      return true;
    }

    return false;
  };

  const cleanup = (element: HTMLElement | null | undefined): void => {
    element?.classList?.remove('dragging');
    setDragState(null);
    clearTimelineDropIndicators(root);
  };

  for (const item of root.querySelectorAll<HTMLElement>('.rot-skill[data-idx]:not(.rot-injected)')) {
    const index = Number(item.dataset.idx);
    const remove = item.querySelector<HTMLElement>('.rot-x');
    if (remove) {
      remove.setAttribute('draggable', 'false');
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
          if (!options.onTruncate) return;
          options.onTruncate(index);
        } else {
          if (!options.onRemove) return;
          options.onRemove(index);
        }

        changed();
      };
    }

    // Editor pencils must behave as controls instead of starting a timeline drag.
    const editControl = item.querySelector<HTMLElement>('.rot-edit-activation, .rot-edit-wait');
    if (editControl) {
      editControl.setAttribute('draggable', 'false');
      editControl.onmousedown = (event) => {
        event.stopPropagation();
      };

      editControl.ondragstart = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };
    }

    item.ondragstart = (event) => {
      if (!Number.isInteger(index)) {
        event.preventDefault();
        return;
      }

      setDragState({ source: 'timeline', index });
      item.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', String(index));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    };

    item.ondragend = () => cleanup(item);
    item.ondragover = (event) => {
      if (!getDragState()) return;
      event.preventDefault();
      clearTimelineDropIndicators(root);
      updateSkillDropIndicator(item, event.clientX);
    };

    item.ondragleave = () => {
      item.classList.remove('drag-insert-before', 'drag-insert-after');
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

  // Every logical line keeps its own insertion boundary even when several lines share one weapon-set label.
  for (const row of root.querySelectorAll<HTMLElement>('.rot-row-skills[data-insert-idx]')) {
    row.ondragover = (event) => {
      // Skill elements own midpoint insertion. Row background drops use the
      // row's precomputed insertion boundary.
      const target = event.target instanceof Element ? event.target : null;
      if (!getDragState() || target?.closest('.rot-skill')) return;
      event.preventDefault();
      clearTimelineDropIndicators(root);
      row.classList.add('drag-over');
    };

    row.ondragleave = (event) => {
      if (event.target === row) row.classList.remove('drag-over');
    };

    row.ondrop = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!getDragState() || target?.closest('.rot-skill')) return;
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
    if (!getDragState() || target?.closest('.rot-row-skills')) return;
    event.preventDefault();
    clearTimelineDropIndicators(root);
    root.classList.add('drag-over-empty');
  };

  root.ondragleave = (event) => {
    if (event.target === root) root.classList.remove('drag-over-empty');
  };

  root.ondrop = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!getDragState() || target?.closest('.rot-row-skills')) return;
    event.preventDefault();
    clearTimelineDropIndicators(root);
    applyDrop(rotation.length);
  };

  const bindEdit = (selector: string, callback: ((index: number, event?: Event) => unknown) | undefined): void => {
    if (!callback) return;
    for (const badge of root.querySelectorAll<HTMLElement>(selector)) {
      badge.onclick = (event) => {
        event.stopPropagation();
        const index = Number(badge.dataset.idx);
        if (!Number.isInteger(index)) return;
        // Returning false means the editor cancelled and no rerender is needed.
        if (callback(index, event) !== false) changed();
      };
    }
  };

  // Concurrent timing badges remain status-only; pencils are their single cast-behavior editor control.
  bindEdit('.rot-edit-activation, .rot-interrupt-badge', options.onEditActivation || options.onEditInterrupt);
  bindEdit('.rot-charge-release-badge', options.onEditReleaseAtCharges);
  bindEdit('.rot-double-edge-badge', options.onEditDoubleEdgeOutcome);
  bindEdit('.rot-edit-wait, .rot-wait-badge', options.onEditWait);

  return { applyDrop, cleanup };
}
