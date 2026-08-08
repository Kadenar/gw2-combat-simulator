export interface RotationInsertionCursorOptions {
  root: HTMLElement;
  insertionIndex: unknown;
  rotationLength: number;
  onSelect(index: number): void;
  onClear(): void;
}

const cursorCleanupByRoot = new WeakMap<HTMLElement, () => void>();

export function normalizeRotationInsertionIndex(
  value: unknown,
  rotationLength: number,
): number | null {
  const length = Math.max(0, Math.floor(Number(rotationLength) || 0));
  if (value === null || value === undefined || value === "") return null;
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index <= length
    ? index
    : null;
}

export function rotationInsertionGapHtml(
  index: number,
  activeIndex: unknown,
): string {
  const active = index === activeIndex;
  return `<button type="button" class="rot-insertion-gap${active ? " active" : ""}" data-insertion-index="${index}"
    title="${active ? "Clear insertion point" : `Insert at position ${index + 1}`}"
    aria-label="${active ? `Insertion point at position ${index + 1}; click to clear` : `Set insertion point at position ${index + 1}`}">
      <span class="rot-insertion-arrow" aria-hidden="true">→</span>
      <span class="rot-insertion-marker" aria-hidden="true"></span>
  </button>`;
}

export function mountRotationInsertionCursor({
  root,
  insertionIndex,
  rotationLength,
  onSelect,
  onClear,
}: RotationInsertionCursorOptions): number | null {
  cursorCleanupByRoot.get(root)?.();

  const activeIndex = normalizeRotationInsertionIndex(
    insertionIndex,
    rotationLength,
  );
  const document = root.ownerDocument;
  let status = root.previousElementSibling as HTMLElement | null;
  if (!status?.classList.contains("rotation-insertion-status")) {
    status = document.createElement("div");
    status.className = "rotation-insertion-status";
    root.before(status);
  }

  if (activeIndex === null) {
    status.hidden = true;
    status.innerHTML = "";
  } else {
    status.hidden = false;
    status.innerHTML = `<span><strong>Insertion point:</strong> position ${activeIndex + 1}. Palette clicks insert here.</span>
      <button type="button" data-clear-insertion>Clear <span aria-hidden="true">×</span></button>`;
    status
      .querySelector<HTMLButtonElement>("[data-clear-insertion]")
      ?.addEventListener("click", onClear);
  }

  root
    .querySelectorAll<HTMLButtonElement>(".rot-insertion-gap")
    .forEach((gap) => {
      gap.addEventListener("mousedown", (event) => event.stopPropagation());
      gap.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const index = Number(gap.dataset.insertionIndex);
        if (!Number.isInteger(index)) return;
        if (index === activeIndex) onClear();
        else onSelect(index);
      });
    });

  const handleEscape = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || activeIndex === null) return;
    onClear();
  };
  document.addEventListener("keydown", handleEscape);
  cursorCleanupByRoot.set(root, () =>
    document.removeEventListener("keydown", handleEscape),
  );
  return activeIndex;
}
