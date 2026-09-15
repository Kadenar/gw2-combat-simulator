import { bindBuildFileImportDialog } from '#gw2/app/build/io/build-file-import-dialog.js';
import { downloadJson, getBuildExportPayload, getBuildWithRotationExportPayload } from '#gw2/app/build/io/files.js';
import { bindRotationImportDialog } from '#gw2/app/build/io/rotation-import-dialog.js';
import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';
import { redoRotation, undoRotation } from '#gw2/app/rotation/editing/history.js';
import { requiredElement, requiredInput, requiredValueControl } from '#ui/shared/dom.js';

import type { ProfessionAppState } from '#gw2/app/types.js';

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
      document.querySelectorAll('.sbar-dropdown.open').forEach((drop) => {
        drop.classList.remove('open');
        drop.parentElement?.querySelector('.sbar-icon')?.setAttribute('aria-expanded', 'false');
      });
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
    downloadJson([
      {
        label: 'Build only',
        filename: app.adapter.filenames.build,
        payload: getBuildExportPayload(app.build)
      },
      {
        label: 'Build + rotation',
        filename: app.adapter.filenames.build.replace(/-build\.json$/i, '-build-rotation.json'),
        payload: getBuildWithRotationExportPayload(app.build)
      }
    ])
  );
  bindBuildFileImportDialog(app, requiredElement('btn-import-build'), requiredInput('import-file-input'));
  app.adapter.buildEditor.bindControls?.(app);
  requiredElement('btn-export-rotation').addEventListener('click', () =>
    downloadJson(app.adapter.filenames.rotation, {
      rotation: app.build.rotation
    })
  );
  const rotationFileInput = requiredInput('rotation-file-input');
  bindRotationImportDialog(app, requiredElement('btn-import-rotation'), rotationFileInput);
  requiredElement('btn-reset-build').addEventListener('click', () => {
    const templateBuild = app.workspace?.tabs.find(({ id }) => id === app.workspace?.activeTabId)?.templateBuild;
    const prompt = templateBuild
      ? 'Reset this build, skills, and rotation to its loaded template?'
      : app.adapter.resetPrompt;
    if (!confirm(prompt)) return;
    // Clone the tab's loaded template so later edits cannot change its reset target.
    app.build = templateBuild ? structuredClone(templateBuild) : createDefaultBuild(app.adapter);
    app.changed();
  });
}
