import { cursorPreviewReady } from '#gw2/app/rotation/cursor-preview.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

/** Keep retained palette input and its status in sync while a newer rotation waits for simulation. */
export function updatePaletteFreshness(app: ProfessionAppState): void {
  if (typeof document === 'undefined') return;

  const root = document.getElementById('rotation-palette');

  if (!root) return;

  const pending = !cursorPreviewReady(app.analysis.state);
  root.dataset.palettePending = String(pending);
  root.setAttribute('aria-busy', String(pending && app.analysis.state.simulationStatus !== 'error'));
  const status = document.querySelector<HTMLElement>('.rotation-builder-heading [data-palette-update-status]');

  if (status) {
    status.hidden = !pending;
    status.textContent = pending
      ? app.analysis.state.simulationStatus === 'error'
        ? 'Simulation failed'
        : 'Updating skills…'
      : '';
  }
}
