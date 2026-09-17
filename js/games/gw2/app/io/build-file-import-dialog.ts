import { bindDialog, showDialog } from '#app/dialog.js';
import {
  applyBuildFileImport,
  BUILD_FILE_IMPORT_ACCEPT,
  previewBuildFileImport
} from '#gw2/app/io/build-file-import.js';
import { readJsonFile } from '#gw2/app/io/files.js';
import {
  bindImportFileSources,
  createImportPreviewController,
  ensureImportDialogStyles,
  importDropZoneHtml,
  renderImportNotices,
  requiredDialogPart
} from '#gw2/app/io/import-dialog.js';
import { ensureDocumentStyles, errorMessage } from '#ui/shared/dom.js';

import type { BuildFileImportPreview, BuildFileImportSelection } from '#gw2/app/io/build-file-import.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2ApplicationBuild } from '#gw2/platform/builds/types.js';

interface BuildFileImportDialogElements {
  readonly dialog: HTMLDialogElement;
  readonly dropZone: HTMLElement;
  readonly browseButton: HTMLButtonElement;
  readonly status: HTMLElement;
  readonly error: HTMLElement;
  readonly parts: HTMLFieldSetElement;
  readonly fileName: HTMLElement;
  readonly buildCheckbox: HTMLInputElement;
  readonly buildDetail: HTMLElement;
  readonly rotationCheckbox: HTMLInputElement;
  readonly rotationDetail: HTMLElement;
  readonly warnings: HTMLElement;
  readonly applyButton: HTMLButtonElement;
}

const BUILD_FILE_IMPORT_STYLES = `
    .build-file-import-dialog { --dialog-width:560px; }
    .build-file-import-parts { display:grid; gap:8px; min-width:0; margin:12px 0 0; padding:0; border:0; }
    .build-file-import-parts legend { margin-bottom:6px; padding:0; color:var(--text-dim); font-size:11px;
      overflow-wrap:anywhere; }
    .build-file-import-part { display:grid; grid-template-columns:auto minmax(0, 1fr); align-items:start; gap:10px;
      padding:10px 12px; border:1px solid var(--border-light); border-radius:6px; background:var(--bg-panel-alt);
      cursor:pointer; }
    .build-file-import-part:has(input:checked) { border-color:var(--accent); }
    .build-file-import-part.is-unavailable { opacity:.55; cursor:not-allowed; }
    .build-file-import-part input { margin:2px 0 0; accent-color:var(--accent); }
    .build-file-import-part strong { display:block; color:var(--text-bright); font-size:13px; }
    .build-file-import-part-detail { display:block; margin-top:3px; color:var(--text-dim); font-size:11px; }
    .build-file-import-summary { display:grid; grid-template-columns:max-content minmax(0, 1fr); gap:2px 10px; margin:0; }
    .build-file-import-summary dt { color:var(--text-dim); }
    .build-file-import-summary dd { margin:0; color:var(--text); overflow-wrap:anywhere; }
    @media (max-width:480px) { .build-file-import-summary { grid-template-columns:1fr; }
      .build-file-import-summary dd + dt { margin-top:4px; } }
  `;

const SKILL_SLOTS = ['Heal', 'Utility1', 'Utility2', 'Utility3', 'Elite'];

function createDialog(document: Document): BuildFileImportDialogElements {
  ensureImportDialogStyles(document);
  ensureDocumentStyles(document, 'build-file-import-styles', BUILD_FILE_IMPORT_STYLES);
  const dialog = document.createElement('dialog');
  dialog.className = 'build-file-import-dialog';
  dialog.setAttribute('aria-labelledby', 'build-file-import-title');
  dialog.innerHTML = `<form class="import-dialog-form app-dialog-body" method="dialog">
    <h3 id="build-file-import-title">Import build</h3>
    <p class="import-dialog-intro">Load a build JSON saved from this simulator. When the file also contains a rotation, choose which parts to apply.</p>
    ${importDropZoneHtml('build-file', 'Drop a build file here', '.json')}
    <p class="import-dialog-status" role="status" data-build-file-status></p>
    <p class="import-dialog-error" role="alert" data-build-file-error hidden></p>
    <fieldset class="build-file-import-parts" data-build-file-parts hidden>
      <legend>Apply from <span data-build-file-name></span></legend>
      <label class="build-file-import-part">
        <input type="checkbox" data-build-file-apply-build>
        <span><strong>Build</strong><span class="build-file-import-part-detail" data-build-file-build-detail></span></span>
      </label>
      <label class="build-file-import-part">
        <input type="checkbox" data-build-file-apply-rotation>
        <span><strong>Rotation</strong><span class="build-file-import-part-detail" data-build-file-rotation-detail></span></span>
      </label>
    </fieldset>
    <ul class="import-dialog-notices" aria-label="Import notices" data-build-file-warnings hidden></ul>
    <div class="app-dialog-actions">
      <button type="button" class="btn" data-dialog-close>Cancel</button>
      <button type="button" class="btn btn-io import-dialog-apply" data-build-file-apply disabled>Apply</button>
    </div>
  </form>`;
  bindDialog(dialog);
  document.body.append(dialog);
  return {
    dialog,
    dropZone: requiredDialogPart(dialog, '[data-build-file-drop]'),
    browseButton: requiredDialogPart(dialog, '[data-build-file-browse]'),
    status: requiredDialogPart(dialog, '[data-build-file-status]'),
    error: requiredDialogPart(dialog, '[data-build-file-error]'),
    parts: requiredDialogPart(dialog, '[data-build-file-parts]'),
    fileName: requiredDialogPart(dialog, '[data-build-file-name]'),
    buildCheckbox: requiredDialogPart(dialog, '[data-build-file-apply-build]'),
    buildDetail: requiredDialogPart(dialog, '[data-build-file-build-detail]'),
    rotationCheckbox: requiredDialogPart(dialog, '[data-build-file-apply-rotation]'),
    rotationDetail: requiredDialogPart(dialog, '[data-build-file-rotation-detail]'),
    warnings: requiredDialogPart(dialog, '[data-build-file-warnings]'),
    applyButton: requiredDialogPart(dialog, '[data-build-file-apply]')
  };
}

/** Summarizes the fields a player recognizes a build by, skipping any that are empty. */
function buildSummary(document: Document, build: Gw2ApplicationBuild): HTMLElement {
  const weaponSet = (weapons: readonly string[]): string => weapons.filter(Boolean).join(' + ');
  const rows: [string, string][] = [
    [
      'Specializations',
      build.specializations
        .map(({ name }) => name)
        .filter(Boolean)
        .join(' · ')
    ],
    ['Weapons', [weaponSet(build.weapons), weaponSet(build.alternateWeapons)].filter(Boolean).join(' / ')],
    [
      'Skills',
      SKILL_SLOTS.map((slot) => build.selectedSkills[slot])
        .filter(Boolean)
        .join(' · ')
    ],
    ['Rune · Relic', [build.rune, build.relic].filter(Boolean).join(' · ')]
  ];
  const list = document.createElement('dl');
  list.className = 'build-file-import-summary';
  for (const [label, value] of rows) {
    if (!value) continue;
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label;
    detail.textContent = value;
    list.append(term, detail);
  }

  return list;
}

function renderPart(checkbox: HTMLInputElement, detail: HTMLElement, content: Node | null): void {
  checkbox.disabled = content === null;
  checkbox.checked = content !== null;
  checkbox.closest('label')?.classList.toggle('is-unavailable', content === null);
  detail.replaceChildren(content ?? 'Not in this file');
}

/** Replaces the plain file picker with a review step that lets the user apply the build, its rotation, or both. */
export function bindBuildFileImportDialog(
  app: ProfessionAppState,
  button: HTMLElement,
  fileInput: HTMLInputElement
): void {
  fileInput.accept = BUILD_FILE_IMPORT_ACCEPT;
  button.setAttribute('aria-haspopup', 'dialog');
  const document = button.ownerDocument;
  const elements = createDialog(document);
  let preview: BuildFileImportPreview | null = null;
  let loading = false;

  const selection = (): BuildFileImportSelection => ({
    build: elements.buildCheckbox.checked,
    rotation: elements.rotationCheckbox.checked
  });

  const syncApply = (): void => {
    const { build, rotation } = selection();
    elements.applyButton.disabled = loading || !preview || (!build && !rotation);
    elements.applyButton.textContent =
      build && rotation ? 'Apply build + rotation' : rotation ? 'Apply rotation' : 'Apply build';
  };

  const reset = (): void => {
    preview = null;
    elements.status.classList.remove('is-success');
    elements.status.textContent = '';
    elements.error.hidden = true;
    elements.error.textContent = '';
    elements.parts.hidden = true;
    renderImportNotices(elements.warnings, []);
    syncApply();
  };

  const showError = (status: string, error: unknown): void => {
    reset();
    elements.status.textContent = status;
    elements.error.hidden = false;
    elements.error.textContent = errorMessage(error);
  };

  const importer = createImportPreviewController<BuildFileImportPreview>(app, {
    begin(message) {
      reset();
      elements.status.textContent = message;
    },
    ready(next) {
      preview = next;
      const actions = next.rotation?.length ?? 0;
      elements.fileName.textContent = next.fileName;
      renderPart(elements.buildCheckbox, elements.buildDetail, next.build && buildSummary(document, next.build));
      renderPart(
        elements.rotationCheckbox,
        elements.rotationDetail,
        next.rotation && document.createTextNode(`${actions} action${actions === 1 ? '' : 's'}`)
      );
      renderImportNotices(elements.warnings, next.warnings);
      elements.parts.hidden = false;
      elements.status.classList.add('is-success');
      elements.status.textContent =
        next.build && next.rotation
          ? 'Choose which parts to apply.'
          : `Ready to apply ${next.build ? 'build' : 'rotation'}.`;
      syncApply();
    },
    fail: showError,
    setLoading(value) {
      loading = value;
      elements.browseButton.disabled = value;
      syncApply();
    },
    settled() {
      // Clear the selection so choosing the same file again still emits a change event.
      fileInput.value = '';
    }
  });

  const selectFile = (file: File): void => {
    void importer.load(
      async () => previewBuildFileImport(await readJsonFile(file), file.name, app),
      `Reading ${file.name}…`,
      `Could not import ${file.name}.`
    );
  };

  button.addEventListener('click', () => {
    reset();
    showDialog(elements.dialog);
  });
  bindImportFileSources(elements.dropZone, elements.browseButton, fileInput, selectFile);
  elements.buildCheckbox.addEventListener('change', syncApply);
  elements.rotationCheckbox.addEventListener('change', syncApply);
  elements.applyButton.addEventListener('click', () => {
    if (!preview) return;
    try {
      importer.validateDestination();
      applyBuildFileImport(app, preview, selection());
    } catch (error) {
      showError('Could not apply the import.', error);
      return;
    }

    elements.dialog.close();
  });
  elements.dialog.addEventListener('close', () => {
    preview = null;
    importer.cancel();
  });
}
