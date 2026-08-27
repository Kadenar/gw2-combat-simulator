import { bindBuildTemplateImportDialog } from './build/io/build-template-import-dialog.js';
import { renderAssumptions } from './build/panels/assumptions.js';
import { renderAttributes } from './build/panels/attributes.js';
import { renderGear } from './build/panels/gear.js';
import { initBuildTemplates, updateTemplateSelection } from './build/panels/presets.js';
import { renderSkills } from './build/panels/skills.js';
import { renderTraits } from './build/panels/traits.js';
import { mountRotationDisplayControls } from './rotation/timeline/display-controls.js';
import type { BuildEditor } from '../../../app/shell/types.js';
import type { ProfessionAppState } from './types.js';

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
    const title = document.querySelector<HTMLElement>('.combat-loadout-title');
    if (!title) throw new Error('Combat loadout header is missing.');
    if (title.querySelector('.combat-loadout-import')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-io combat-loadout-import';
    button.textContent = 'Import GW2 Build';
    title.append(button);
    bindBuildTemplateImportDialog(app, button);
  }
});
