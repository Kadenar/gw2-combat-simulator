/** Owns persisted application preferences for simulated proc overlays on the rotation timeline. */
export const ROTATION_PROC_OVERLAY_STORAGE_KEYS = Object.freeze({
  sigil: 'gw2-rotation-overlay-sigil-procs',
  relic: 'gw2-rotation-overlay-relic-procs',
  sovereignOfLight: 'gw2-rotation-overlay-sovereign-of-light-procs'
} as const);

export type RotationProcOverlayType = keyof typeof ROTATION_PROC_OVERLAY_STORAGE_KEYS;

export function normalizeRotationProcOverlayVisibility(value: unknown): boolean {
  return value === true || value === 'true';
}

/** Restores timeline-only proc overlay choices without coupling them to saved builds or simulation inputs. */
export function readStoredRotationProcOverlayVisibility(root: Document, type: RotationProcOverlayType): boolean {
  try {
    return normalizeRotationProcOverlayVisibility(
      root.defaultView?.localStorage.getItem(ROTATION_PROC_OVERLAY_STORAGE_KEYS[type])
    );
  } catch {
    return false;
  }
}

/** Persists proc overlay choices immediately so every profession timeline uses the same display preference. */
export function storeRotationProcOverlayVisibility(
  root: Document,
  type: RotationProcOverlayType,
  visible: boolean
): void {
  try {
    root.defaultView?.localStorage.setItem(ROTATION_PROC_OVERLAY_STORAGE_KEYS[type], String(visible));
  } catch {
    // Browser storage may be unavailable in private or embedded contexts.
  }
}
