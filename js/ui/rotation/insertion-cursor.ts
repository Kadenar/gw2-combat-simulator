import { shouldIgnoreHotkey } from '#ui/shared/dom.js';

export interface RotationInsertionCursorOptions {
  root: HTMLElement;
  insertionIndex: unknown;
  rotationLength: number;
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

export function rotationInsertionGapHtml(index: number, activeIndex: unknown): string {
  const active = index === activeIndex;
  return `<button type="button" class="rot-insertion-gap${active ? ' active' : ''}" data-insertion-index="${index}"
    title="${active ? `Insertion point at position ${index + 1}` : `Insert at position ${index + 1}`}"
    aria-label="${active ? `Insertion point at position ${index + 1}` : `Set insertion point at position ${index + 1}`}">
      <span class="rot-insertion-arrow" aria-hidden="true">→</span>
      <span class="rot-insertion-marker" aria-hidden="true"></span>
  </button>`;
}

export function rotationTimelineEntryHtml(index: number, activeIndex: unknown, entryHtml: string): string {
  // Keep everything at a rotation boundary after its insertion cursor so the visual order matches insertion behavior.
  return `<div class="rot-entry">
    ${rotationInsertionGapHtml(index, activeIndex)}
    ${entryHtml}
  </div>`;
}

export function mountRotationInsertionCursor({
  root,
  insertionIndex,
  rotationLength,
  onSelect,
  onClear
}: RotationInsertionCursorOptions): number | null {
  cursorCleanupByRoot.get(root)?.();

  const existingStatus = root.previousElementSibling;
  if (existingStatus?.classList.contains('rotation-insertion-status')) {
    existingStatus.remove();
  }

  const activeIndex = normalizeRotationInsertionIndex(insertionIndex, rotationLength);
  const document = root.ownerDocument;
  const scope = root.closest('.rotation-panel') || root;

  root.querySelectorAll<HTMLButtonElement>('.rot-insertion-gap').forEach((gap) => {
    // Property handlers are replaced when keyed timeline nodes survive a render.
    gap.onmousedown = (event) => event.stopPropagation();
    gap.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const index = Number(gap.dataset.insertionIndex);
      if (!Number.isInteger(index)) return;
      const displayActive = activeIndex ?? rotationLength;
      if (index === displayActive) return;
      if (index === rotationLength) onClear();
      else onSelect(index);
    };
  });

  const handleEscape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || activeIndex === null) return;
    onClear();
  };

  const handleArrow = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (shouldIgnoreHotkey(event)) return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    const focused = document.activeElement;
    if (focused && focused !== document.body && !scope.contains(focused)) return;
    const displayIndex = activeIndex ?? rotationLength;
    if (event.key === 'ArrowLeft') {
      if (displayIndex <= 0) return;
      event.preventDefault();
      const newIndex = displayIndex - 1;
      if (newIndex >= rotationLength) onClear();
      else onSelect(newIndex);
    } else {
      if (displayIndex >= rotationLength) return;
      event.preventDefault();
      const newIndex = displayIndex + 1;
      if (newIndex >= rotationLength) onClear();
      else onSelect(newIndex);
    }
  };

  document.addEventListener('keydown', handleEscape);
  document.addEventListener('keydown', handleArrow);
  cursorCleanupByRoot.set(root, () => {
    document.removeEventListener('keydown', handleEscape);
    document.removeEventListener('keydown', handleArrow);
  });
  return activeIndex;
}
