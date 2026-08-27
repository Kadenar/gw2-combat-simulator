import { bindBuildTemplateImportDialog } from './io/build-template-import-dialog.js';
import { downloadJson, getBuildExportPayload, readJsonFile } from './io/files.js';
import { bindRotationImportDialog } from './io/rotation-import-dialog.js';
import { createDefaultBuild, replaceBuildConfiguration } from './state/persistence.js';
import { redoRotation, undoRotation } from '../rotation/editing/history.js';
import { errorMessage, requiredElement, requiredInput, requiredValueControl } from '../../platform/ui/shared/dom.js';

import type { ProfessionAppState } from '../profession/types.js';

export function bindPageControls(app: ProfessionAppState): void {
  const attributeWeaponSet = requiredValueControl('attribute-weapon-set');
  attributeWeaponSet.addEventListener('change', () => {
    app.attributeWeaponSet = Number(attributeWeaponSet.value) === 2 ? 2 : 1;
    app.adapter.recalculate(app);
    app.renderAttributes();
  });
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof Element && !target.closest('.skill-bar-slot, .skill-bar-inspection-slot')) {
      document.querySelectorAll('.sbar-dropdown.open').forEach((drop) => drop.classList.remove('open'));
    }
  });
  requiredElement('btn-sim-clear').addEventListener('click', () => {
    app.build.rotation = [];
    app.changed(false);
  });
  document.getElementById('btn-sim-undo')?.addEventListener('click', () => undoRotation(app));
  document.getElementById('btn-sim-redo')?.addEventListener('click', () => redoRotation(app));
  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      undoRotation(app);
    } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
      event.preventDefault();
      redoRotation(app);
    }
  });
  requiredElement('btn-export-build').addEventListener('click', () =>
    downloadJson(app.adapter.filenames.build, getBuildExportPayload(app.build))
  );
  const importFileInput = requiredInput('import-file-input');
  const importBuildButton = requiredElement('btn-import-build');
  importBuildButton.addEventListener('click', () => importFileInput.click());
  const importCodeButton = document.createElement('button');
  importCodeButton.type = 'button';
  importCodeButton.className = 'btn btn-io combat-loadout-import';
  importCodeButton.textContent = 'Import GW2 Build';
  // Build codes change weapons, traits, and selected skills, so their action
  // belongs on the combined combat-loadout card instead of the gear toolbar.
  const combatLoadoutTitle = document.querySelector<HTMLElement>('.combat-loadout-title');
  if (!combatLoadoutTitle) {
    throw new Error('Combat loadout header is missing.');
  }

  combatLoadoutTitle.append(importCodeButton);
  bindBuildTemplateImportDialog(app, importCodeButton);
  importFileInput.addEventListener('change', async () => {
    const file = importFileInput.files?.[0];
    if (!file) return;
    try {
      app.build = replaceBuildConfiguration(await readJsonFile(file), app.build, app.adapter);
      app.changed();
    } catch (error) {
      alert(errorMessage(error));
    }
  });
  requiredElement('btn-export-rotation').addEventListener('click', () =>
    downloadJson(app.adapter.filenames.rotation, {
      rotation: app.build.rotation
    })
  );
  const rotationFileInput = requiredInput('rotation-file-input');
  bindRotationImportDialog(app, requiredElement('btn-import-rotation'), rotationFileInput);
  requiredElement('btn-reset-build').addEventListener('click', () => {
    if (!confirm(app.adapter.resetPrompt)) return;
    app.build = createDefaultBuild(app.adapter);
    app.changed();
  });
}
