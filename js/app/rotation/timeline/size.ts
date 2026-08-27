/** Owns the persisted display size and idle-time visibility of the application timeline. */
export const ROTATION_TIMELINE_SIZE_STORAGE_KEY = 'gw2-rotation-timeline-size';
export const ROTATION_DEAD_TIME_STORAGE_KEY = 'gw2-rotation-dead-time';

export const ROTATION_TIMELINE_SIZE_OPTIONS = Object.freeze([
  { value: 'normal', label: '100%' },
  { value: 'large', label: '125%' },
  { value: 'extra-large', label: '150%' }
] as const);

export type RotationTimelineSize = (typeof ROTATION_TIMELINE_SIZE_OPTIONS)[number]['value'];

export function normalizeRotationTimelineSize(value: unknown): RotationTimelineSize {
  const match = ROTATION_TIMELINE_SIZE_OPTIONS.find((option) => option.value === value);
  return match?.value || 'normal';
}

export function normalizeRotationDeadTimeVisibility(value: unknown): boolean {
  return value === true || value === 'true';
}

function readStoredSize(root: Document): RotationTimelineSize {
  try {
    return normalizeRotationTimelineSize(root.defaultView?.localStorage.getItem(ROTATION_TIMELINE_SIZE_STORAGE_KEY));
  } catch {
    return 'normal';
  }
}

function storeSize(root: Document, size: RotationTimelineSize): void {
  try {
    root.defaultView?.localStorage.setItem(ROTATION_TIMELINE_SIZE_STORAGE_KEY, size);
  } catch {
    // Browser storage may be unavailable in private or embedded contexts.
  }
}

export function readStoredRotationDeadTimeVisibility(root: Document): boolean {
  try {
    return normalizeRotationDeadTimeVisibility(root.defaultView?.localStorage.getItem(ROTATION_DEAD_TIME_STORAGE_KEY));
  } catch {
    return false;
  }
}

function storeDeadTimeVisibility(root: Document, visible: boolean): void {
  try {
    root.defaultView?.localStorage.setItem(ROTATION_DEAD_TIME_STORAGE_KEY, String(visible));
  } catch {
    // Browser storage may be unavailable in private or embedded contexts.
  }
}

export function rotationDeadTimeVisibility(root: Document): boolean {
  const panel = root.getElementById('rotation-timeline')?.closest<HTMLElement>('.rotation-panel');
  return panel?.dataset.showDeadTime === undefined
    ? readStoredRotationDeadTimeVisibility(root)
    : normalizeRotationDeadTimeVisibility(panel.dataset.showDeadTime);
}

/** Applies and persists dead-time visibility without treating it as a simulation configuration change. */
export function setRotationDeadTimeVisibility(root: Document, visible: boolean): void {
  const panel = root.getElementById('rotation-timeline')?.closest<HTMLElement>('.rotation-panel');

  if (panel) panel.dataset.showDeadTime = String(visible);
  storeDeadTimeVisibility(root, visible);
}

export function mountRotationTimelineSize(root: Document = document): void {
  const timeline = root.getElementById('rotation-timeline');
  const toolbar = timeline?.closest<HTMLElement>('.rotation-panel')?.querySelector<HTMLElement>('.rotation-mid');
  const panel = timeline?.closest<HTMLElement>('.rotation-panel');

  if (!timeline || !toolbar || !panel) return;

  const storedSize = readStoredSize(root);
  const showDeadTime = readStoredRotationDeadTimeVisibility(root);
  panel.dataset.rotationSize = storedSize;
  panel.dataset.showDeadTime = String(showDeadTime);

  const existing = root.getElementById('rotation-timeline-size');

  if (existing?.tagName === 'SELECT') {
    (existing as HTMLSelectElement).value = storedSize;
  } else {
    const control = root.createElement('label');
    control.className = 'rotation-size-control';
    control.htmlFor = 'rotation-timeline-size';

    const label = root.createElement('span');
    label.textContent = 'Timeline size';
    control.append(label);

    const select = root.createElement('select');
    select.id = 'rotation-timeline-size';
    select.title = 'Change the size of skills in the rotation timeline';
    for (const option of ROTATION_TIMELINE_SIZE_OPTIONS) {
      const element = root.createElement('option');
      element.value = option.value;
      element.textContent = option.label;
      select.append(element);
    }

    select.value = storedSize;
    select.addEventListener('change', () => {
      const size = normalizeRotationTimelineSize(select.value);
      select.value = size;
      panel.dataset.rotationSize = size;
      storeSize(root, size);
    });
    control.append(select);

    const startState = toolbar.querySelector('.start-att-selector');
    toolbar.insertBefore(control, startState || toolbar.querySelector('.rotation-btns'));
  }
}
