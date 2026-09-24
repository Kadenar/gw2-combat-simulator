import type { RotationCommand } from '#gw2/platform/execution/types.js';
import type { ProfessionRotationDragState } from '#gw2/app/types.js';

export interface TimelineInteractionOptions {
  readonly rotation: RotationCommand[];
  /** Rejects indexed gestures when retained DOM belongs to an older build. */
  readonly canInteract?: () => boolean;
  readonly getDragState: () => ProfessionRotationDragState | null | undefined;
  readonly setDragState: (value: ProfessionRotationDragState | null) => void;
  /** Applies a timeline drag through the application-owned rotation editing layer. */
  readonly moveEntry: (fromIndex: number, toIndex: number) => boolean;
  /** Applies one resolved palette item or macro through the application-owned editing layer. */
  readonly insertEntries: (entries: readonly RotationCommand[], insertAt: number) => boolean;
  readonly resolvePaletteEntry?: (
    name: string,
    drag: ProfessionRotationDragState | null | undefined,
    insertAt: number
  ) => RotationCommand | RotationCommand[] | null | undefined;
  readonly onChanged?: () => void;
  readonly onRemove?: (index: number, event?: Event) => unknown;
  readonly onTruncate?: (index: number, event?: Event) => unknown;
  readonly onEditActivation?: (index: number, event?: Event) => unknown;
  readonly onEditDoubleEdgeOutcome?: (index: number, event?: Event) => unknown;
  readonly onEditWait?: (index: number, event?: Event) => unknown;
}

export function clearTimelineDropIndicators(root: HTMLElement | null | undefined): void {
  if (!root) return;
  root.classList.remove('drag-active', 'drag-over-empty');
  root
    .querySelectorAll<HTMLElement>('.drag-drop-target')
    .forEach((element) => element.classList.remove('drag-drop-target'));
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
  const canInteract = options.canInteract || (() => true);
  const changed = (): void => {
    options.onChanged?.();
  };

  const applyDrop = (insertAt: number): boolean => {
    const drag = getDragState();
    if (!drag) return false;
    setDragState(null);
    if (!canInteract()) return false;
    if (drag.source === 'timeline') {
      const fromIndex = Number(drag.index);
      if (!options.moveEntry(fromIndex, insertAt)) return false;
      changed();
      return true;
    }

    if (drag.source === 'palette') {
      const name = String(drag.name ?? '');
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
        if (!canInteract() || !Number.isInteger(index)) return;
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
      if (!canInteract() || !Number.isInteger(index)) {
        event.preventDefault();
        return;
      }

      setDragState({ source: 'timeline', index });
      item.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', String(index));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    };

    item.ondragend = () => cleanup(item);
  }

  // Hover and drop resolve the same boundary, including gaps and whitespace in wrapped rows.
  const dropIndex = (event: DragEvent): number => {
    const target = event.target instanceof Element ? event.target : null;
    const gap = target?.closest<HTMLElement>('.rot-insertion-gap');
    if (gap) return Number(gap.dataset.insertionIndex);
    const skill = target?.closest<HTMLElement>('.rot-skill[data-idx]:not(.rot-injected)');
    if (skill) return getSkillDropInsertionIndex(skill, event.clientX) ?? rotation.length;
    const row = target?.closest('.rot-row-skills');
    let nearest: HTMLElement | undefined;
    let distance = Infinity;
    for (const card of row?.querySelectorAll<HTMLElement>('.rot-skill[data-idx]:not(.rot-injected)') || []) {
      const rect = card.getBoundingClientRect();
      const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
      const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
      const candidateDistance = dx * dx + dy * dy;
      if (candidateDistance < distance) {
        nearest = card;
        distance = candidateDistance;
      }
    }

    return nearest ? (getSkillDropInsertionIndex(nearest, event.clientX) ?? rotation.length) : rotation.length;
  };

  root.ondragover = (event) => {
    if (!canInteract() || !getDragState()) return;
    event.preventDefault();
    event.stopPropagation();
    const index = dropIndex(event);
    const marker = root.querySelector<HTMLElement>(`.rot-insertion-gap[data-insertion-index="${index}"]`);
    // Keep the marker stable across repeated events and transitions between a card's children.
    if (!marker?.classList.contains('drag-drop-target')) {
      clearTimelineDropIndicators(root);
      marker?.classList.add('drag-drop-target');
    }

    root.classList.add('drag-active');
    if (!marker) root.classList.add('drag-over-empty');
  };

  root.ondragleave = (event) => {
    if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
    const rect = root.getBoundingClientRect();
    if (
      event.clientX >= rect.left &&
      event.clientX < rect.right &&
      event.clientY >= rect.top &&
      event.clientY < rect.bottom
    )
      return;
    clearTimelineDropIndicators(root);
  };

  root.ondrop = (event) => {
    if (!getDragState()) return;
    event.preventDefault();
    event.stopPropagation();
    const index = dropIndex(event);
    clearTimelineDropIndicators(root);
    applyDrop(index);
  };

  const bindEdit = (selector: string, callback: ((index: number, event?: Event) => unknown) | undefined): void => {
    if (!callback) return;
    for (const badge of root.querySelectorAll<HTMLElement>(selector)) {
      badge.onclick = (event) => {
        event.stopPropagation();
        const index = Number(badge.dataset.idx);
        if (!canInteract() || !Number.isInteger(index)) return;
        // Returning false means the editor cancelled and no rerender is needed.
        if (callback(index, event) !== false) changed();
      };
    }
  };

  // Pencils select the skill's cast editor; charge badges only display the chosen release threshold.
  bindEdit('.rot-edit-activation, .rot-interrupt-badge', options.onEditActivation);
  bindEdit('.rot-double-edge-badge', options.onEditDoubleEdgeOutcome);
  bindEdit('.rot-edit-wait, .rot-wait-badge', options.onEditWait);

  return { applyDrop, cleanup };
}
