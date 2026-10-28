import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { bindBuildFileImportDialog } from '#gw2/app/import-export/build-file-import-dialog.js';
import {
  downloadJson,
  getBuildExportPayload,
  getBuildWithRotationExportPayload
} from '#gw2/app/import-export/files.js';
import { bindRotationImportDialog } from '#gw2/app/import-export/rotation-import-dialog.js';
import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';
import { redoRotation, undoRotation } from '#gw2/app/rotation/editing/history.js';
import { requiredElement, requiredInput, requiredSelect } from '#ui/shared/dom.js';

import type { ProfessionAppState } from '#gw2/app/types.js';

/** Coordinates build transfers, reset, and rotation history for the active application session. */
export function bindSessionControls(app: ProfessionAppState): void {
  const attributeWeaponSet = requiredSelect('attribute-weapon-set');
  attributeWeaponSet.addEventListener('change', () => {
    app.attributeWeaponSet = Number(attributeWeaponSet.value) === 2 ? 2 : 1;
    app.attributeData = app.adapter
      .createBuildContext({
        build: app.build,
        patch: app.patch,
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays)
      })
      .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
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
    // Creating an encounter has no active rotation; leave the parked golem history untouched.
    if (document.body.dataset.simulatorView === 'bosses' && document.body.dataset.bossEditorReady === 'false') return;

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
  // One header pair transfers the active document, including encounter inputs in Bosses.
  requiredElement('btn-export-build').addEventListener('click', () => {
    if (app.workspace?.fileActions) {
      app.workspace.fileActions.export();
      return;
    }

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
    ]);
  });
  const openBuildImport = bindBuildFileImportDialog(app, requiredInput('import-file-input'));
  const importButton = requiredElement('btn-import-build');
  importButton.setAttribute('aria-haspopup', 'dialog');
  importButton.addEventListener('click', () => {
    if (app.workspace?.fileActions) app.workspace.fileActions.import();
    else openBuildImport();
  });
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
