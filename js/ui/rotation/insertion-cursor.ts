import { shouldIgnoreHotkey } from '#ui/shared/dom.js';

export interface RotationInsertionCursorOptions {
  root: HTMLElement;
  getInsertionIndex(): unknown;
  getRotationLength(): number;
  onSelect(index: number): void;
  onClear(): void;
}

const cursorCleanupByRoot = new WeakMap<HTMLElement, () => void>();

export function normalizeRotationInsertionIndex(value: unknown, rotationLength: number): number | null {
  const length = Math.max(0, Math.floor(Number(rotationLength) || 0));

  if (value === null || value === undefined || value === '') return null;

  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index <= length ? index : null;
}

function insertionGapTitle(index: number, active: boolean): string {
  return active ? `Insertion point at position ${index + 1}` : `Insert at position ${index + 1}`;
}

function insertionGapLabel(index: number, active: boolean): string {
  return active ? `Insertion point at position ${index + 1}` : `Set insertion point at position ${index + 1}`;
}

/** Row HTML stays cursor-neutral so cursor moves cannot invalidate retained rows; mounting marks the active gap. */
export function rotationInsertionGapHtml(index: number): string {
  return `<button type="button" class="rot-insertion-gap" data-insertion-index="${index}"
    title="${insertionGapTitle(index, false)}"
    aria-label="${insertionGapLabel(index, false)}">
      <span class="rot-insertion-arrow" aria-hidden="true">→</span>
      <span class="rot-insertion-marker" aria-hidden="true"></span>
  </button>`;
}

export function rotationTimelineEntryHtml(index: number, entryHtml: string): string {
  // Keep everything at a rotation boundary after its insertion cursor so the visual order matches insertion behavior.
  return `<div class="rot-entry">
    ${rotationInsertionGapHtml(index)}
    ${entryHtml}
  </div>`;
}

/** Move the marker on retained rows without replacing skill nodes or disturbing focus and timeline scroll state. */
export function updateRotationInsertionCursor(
  root: HTMLElement,
  insertionIndex: unknown,
  rotationLength: number
): number | null {
  const activeIndex = normalizeRotationInsertionIndex(insertionIndex, rotationLength);
  const displayIndex = activeIndex ?? rotationLength;
  for (const gap of root.querySelectorAll<HTMLButtonElement>('.rot-insertion-gap')) {
    const index = Number(gap.dataset.insertionIndex);
    const active = index === displayIndex;

    if (gap.classList.contains('active') === active) continue;

    gap.classList.toggle('active', active);
    gap.title = insertionGapTitle(index, active);
    gap.setAttribute('aria-label', insertionGapLabel(index, active));
  }

  return activeIndex;
}

export function mountRotationInsertionCursor({
  root,
  getInsertionIndex,
  getRotationLength,
  onSelect,
  onClear
}: RotationInsertionCursorOptions): number | null {
  cursorCleanupByRoot.get(root)?.();

  const existingStatus = root.previousElementSibling;

  if (existingStatus?.classList.contains('rotation-insertion-status')) {
    existingStatus.remove();
  }

  const activeIndex = updateRotationInsertionCursor(root, getInsertionIndex(), getRotationLength());
  const document = root.ownerDocument;
  const scope = root.closest('.rotation-panel') || root;
  // Handlers outlive cursor-only updates and deferred edits, so both values are read live rather than at mount.
  const currentIndex = (): number | null => normalizeRotationInsertionIndex(getInsertionIndex(), getRotationLength());
  const displayIndex = (): number => currentIndex() ?? getRotationLength();
  // The app can reject a move for a stale build revision; only an accepted move may hide hover previews or move focus.
  const moveWithKeyboard = (move: () => void, revealCursor: boolean): void => {
    const previousIndex = displayIndex();
    move();

    if (displayIndex() === previousIndex) return;

    root.dataset.insertionNavigation = 'keyboard';
    const gap = root.querySelector<HTMLButtonElement>('.rot-insertion-gap.active');

    if (!gap) return;

    const focused = document.activeElement;
    const focusOnGap = !!focused?.matches('.rot-insertion-gap') && root.contains(focused);

    // Focus leaves the previous gap so its focus marker cannot look like a second cursor.
    if (focusOnGap) gap.focus({ preventScroll: true });

    // Clearing the cursor from outside the timeline must not jump the viewport to the trailing gap.
    if (focusOnGap || revealCursor) gap.scrollIntoView({ block: 'nearest' });
  };

  // A stationary pointer must not keep the old hover marker visible during keyboard navigation.
  root.onpointermove = () => {
    delete root.dataset.insertionNavigation;
  };

  root.querySelectorAll<HTMLButtonElement>('.rot-insertion-gap').forEach((gap) => {
    // Property handlers are replaced when keyed timeline nodes survive a render.
    gap.onmousedown = (event) => event.stopPropagation();
    gap.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      delete root.dataset.insertionNavigation;
      const index = Number(gap.dataset.insertionIndex);

      if (!Number.isInteger(index)) return;

      if (index === displayIndex()) return;

      if (index === getRotationLength()) onClear();
      else onSelect(index);
    };
  });

  const handleEscape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || currentIndex() === null) return;

    // Clearing the cursor consumes Escape; the surrounding Focus view must stay open.
    event.preventDefault();
    moveWithKeyboard(onClear, false);
  };

  const handleArrow = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    if (shouldIgnoreHotkey(event)) return;

    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;

    const focused = document.activeElement;

    if (focused && focused !== document.body && !scope.contains(focused)) return;

    const rotationLength = getRotationLength();
    const newIndex = displayIndex() + (event.key === 'ArrowLeft' ? -1 : 1);

    if (newIndex < 0 || newIndex > rotationLength) return;

    event.preventDefault();
    moveWithKeyboard(() => (newIndex === rotationLength ? onClear() : onSelect(newIndex)), true);
  };

  document.addEventListener('keydown', handleEscape);
  document.addEventListener('keydown', handleArrow);
  cursorCleanupByRoot.set(root, () => {
    document.removeEventListener('keydown', handleEscape);
    document.removeEventListener('keydown', handleArrow);
  });
  return activeIndex;
}
