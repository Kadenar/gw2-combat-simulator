/** Exercises the same completed projection and markup seam as the mounted palette. */
import { projectPalette } from '#gw2/app/rotation/palette/model.js';
import { paletteHtml } from '#gw2/app/rotation/palette/view.js';

export function renderPaletteMarkup(app) {
  return paletteHtml(projectPalette(app));
}
