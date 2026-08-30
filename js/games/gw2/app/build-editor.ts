import { bindBuildTemplateImportDialog } from '#gw2/app/build/io/build-template-import-dialog.js';
import { renderAssumptions } from '#gw2/app/build/panels/assumptions.js';
import { renderAttributes } from '#gw2/app/build/panels/attributes.js';
import { renderGear } from '#gw2/app/build/panels/gear.js';
import { initBuildTemplates, updateTemplateSelection } from '#gw2/app/build/panels/presets.js';
import { renderSkills } from '#gw2/app/build/panels/skills.js';
import { renderTraits } from '#gw2/app/build/panels/traits.js';
import { mountRotationDisplayControls } from '#gw2/app/rotation/timeline/display-controls.js';
import type { BuildEditor } from '#app/shell/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

/** Supplies the existing GW2 editor sections through the game-neutral contribution contract. */
export const gw2BuildEditor: BuildEditor<ProfessionAppState> = Object.freeze({
  sections: Object.freeze([
    { id: 'gear', render: renderGear },
    { id: 'traits', render: renderTraits },
    { id: 'attributes', render: renderAttributes },
    { id: 'skills', render: renderSkills },
    {
      id: 'assumptions',
      render(app: ProfessionAppState) {
        renderAssumptions(app);
        mountRotationDisplayControls(app);
      }
    }
  ]),
  initialize: initBuildTemplates,
  updateSelection: updateTemplateSelection,
  bindControls(app: ProfessionAppState) {
    // Keep in-game build import beside the remaining build choices after removing the preview-only combat layout.
    const title = document.querySelector<HTMLElement>('.selectable-skills-title');
    if (!title) throw new Error('Selectable skills header is missing.');
    if (title.querySelector('.build-template-import')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-io build-template-import';
    button.textContent = 'Import GW2 Build';
    title.append(button);
    bindBuildTemplateImportDialog(app, button);
  }
});
