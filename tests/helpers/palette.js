import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { inertContainer } from './dom.js';

/** Captures palette markup without binding DOM controls and restores the document even if rendering fails. */
export function renderPaletteMarkup(app) {
  const palette = inertContainer();
  const previousDocument = globalThis.document;

  globalThis.document = {
    getElementById: (id) => (id === 'rotation-palette' ? palette : null)
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  return palette.innerHTML;
}
