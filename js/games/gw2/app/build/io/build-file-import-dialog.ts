import { bindDialog, showDialog } from '#app/dialog.js';
import {
  applyBuildFileImport,
  BUILD_FILE_IMPORT_ACCEPT,
  previewBuildFileImport
} from '#gw2/app/build/io/build-file-import.js';
import { readJsonFile } from '#gw2/app/build/io/files.js';
import { captureBuildDestination } from '#gw2/app/build/state/workspace.js';
import { ensureDocumentStyles, errorMessage } from '#ui/shared/dom.js';

import type { BuildFileImportPreview, BuildFileImportSelection } from '#gw2/app/build/io/build-file-import.js';
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
    .build-file-import-form h3 { margin:0 0 6px; color:var(--text-bright); }
    .build-file-import-intro { margin:0 0 14px; color:var(--text-dim); font-size:12px; line-height:1.5; }
    .build-file-import-drop { display:flex; min-height:130px; padding:20px; align-items:center;
      justify-content:center; border:2px dashed var(--border-light); border-radius:8px;
      background:var(--bg-panel-alt); text-align:center; transition:border-color .15s, background .15s; }
    .build-file-import-drop.is-dragging { border-color:var(--accent); background:rgba(102,170,255,.08); }
    .build-file-import-drop strong { display:block; margin-bottom:5px; color:var(--text-bright); font-size:13px; }
    .build-file-import-drop small { display:block; margin:8px 0; color:var(--text-dim); font-size:10px; }
    /* Class display rules would otherwise override the hidden attribute on these grid containers. */
    .build-file-import-dialog [hidden], .build-file-import-status:empty { display:none; }
    .build-file-import-status { margin:12px 0 0; color:var(--text-dim); font-size:12px; }
    .build-file-import-status.is-success { color:var(--health); }
    .build-file-import-error { margin:12px 0 0; color:var(--condi); font-size:12px; white-space:pre-wrap; }
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
    .build-file-import-warnings { display:grid; gap:6px; margin:10px 0 0; padding:0; list-style:none; font-size:11px; }
    .build-file-import-warnings li { padding:8px 10px; border:1px solid var(--border); border-radius:5px;
      background:rgba(166,124,34,.06); color:var(--text-dim); line-height:1.45; }
    .build-file-import-warnings strong { display:block; margin-bottom:2px; color:var(--text-bright); }
    .build-file-import-actions [data-build-file-apply]:disabled { opacity:.45; cursor:not-allowed; }
    @media (max-width:480px) { .build-file-import-summary { grid-template-columns:1fr; }
      .build-file-import-summary dd + dt { margin-top:4px; } }
  `;

const SKILL_SLOTS = ['Heal', 'Utility1', 'Utility2', 'Utility3', 'Elite'];

function required<T extends Element>(dialog: HTMLDialogElement, selector: string): T {
  const element = dialog.querySelector<T>(selector);
  if (!element) throw new Error('Build import dialog failed to initialize.');
  return element;
}

function createDialog(document: Document): BuildFileImportDialogElements {
  ensureDocumentStyles(document, 'build-file-import-styles', BUILD_FILE_IMPORT_STYLES);
  const dialog = document.createElement('dialog');
  dialog.className = 'build-file-import-dialog';
  dialog.setAttribute('aria-labelledby', 'build-file-import-title');
  dialog.innerHTML = `<form class="build-file-import-form app-dialog-body" method="dialog">
    <h3 id="build-file-import-title">Import build</h3>
    <p class="build-file-import-intro">Load a build JSON saved from this simulator. When the file also contains a rotation, choose which parts to apply.</p>
    <div class="build-file-import-drop" data-build-file-drop>
      <div>
        <strong>Drop a build file here</strong>
        <small>.json</small>
        <button type="button" class="btn btn-io" data-build-file-browse>Browse files</button>
      </div>
    </div>
    <p class="build-file-import-status" role="status" data-build-file-status></p>
    <p class="build-file-import-error" role="alert" data-build-file-error hidden></p>
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
    <ul class="build-file-import-warnings" aria-label="Import notices" data-build-file-warnings hidden></ul>
    <div class="build-file-import-actions app-dialog-actions">
      <button type="button" class="btn" data-dialog-close>Cancel</button>
      <button type="button" class="btn btn-io" data-build-file-apply disabled>Apply</button>
    </div>
  </form>`;
  bindDialog(dialog);
  document.body.append(dialog);
  return {
    dialog,
    dropZone: required(dialog, '[data-build-file-drop]'),
    browseButton: required(dialog, '[data-build-file-browse]'),
    status: required(dialog, '[data-build-file-status]'),
    error: required(dialog, '[data-build-file-error]'),
    parts: required(dialog, '[data-build-file-parts]'),
    fileName: required(dialog, '[data-build-file-name]'),
    buildCheckbox: required(dialog, '[data-build-file-apply-build]'),
    buildDetail: required(dialog, '[data-build-file-build-detail]'),
    rotationCheckbox: required(dialog, '[data-build-file-apply-rotation]'),
    rotationDetail: required(dialog, '[data-build-file-rotation-detail]'),
    warnings: required(dialog, '[data-build-file-warnings]'),
    applyButton: required(dialog, '[data-build-file-apply]')
  };
}

/** Summarizes the fields a player recognizes a build by, skipping any that are empty. */
function buildSummary(document: Document, build: Gw2ApplicationBuild): HTMLElement {
  const weaponSet = (weapons: readonly string[]): string => weapons.filter(Boolean).join(' + ');
  const rows: [string, string][] = [
    ['Specializations', build.specializations.map(({ name }) => name).filter(Boolean).join(' · ')],
    ['Weapons', [weaponSet(build.weapons), weaponSet(build.alternateWeapons)].filter(Boolean).join(' / ')],
    ['Skills', SKILL_SLOTS.map((slot) => build.selectedSkills[slot]).filter(Boolean).join(' · ')],
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

/** Renders "Label: detail" notices with the label emphasized, matching the rotation import dialog. */
function renderWarnings(element: HTMLElement, warnings: readonly string[]): void {
  element.replaceChildren(
    ...warnings.map((warning) => {
      const item = element.ownerDocument.createElement('li');
      const separator = warning.indexOf(':');
      if (separator > 0 && separator < 40) {
        const label = element.ownerDocument.createElement('strong');
        label.textContent = warning.slice(0, separator);
        item.append(label, warning.slice(separator + 1).trim());
      } else {
        item.textContent = warning;
      }

      return item;
    })
  );
  element.hidden = warnings.length === 0;
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
  let generation = 0;
  let validatePreviewDestination = (): void => {};

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

  const setLoading = (value: boolean): void => {
    loading = value;
    elements.browseButton.disabled = value;
    syncApply();
  };

  const reset = (): void => {
    preview = null;
    elements.status.classList.remove('is-success');
    elements.status.textContent = '';
    elements.error.hidden = true;
    elements.error.textContent = '';
    elements.parts.hidden = true;
    elements.warnings.hidden = true;
    elements.warnings.replaceChildren();
    syncApply();
  };

  const showError = (status: string, error: unknown): void => {
    reset();
    elements.status.textContent = status;
    elements.error.hidden = false;
    elements.error.textContent = errorMessage(error);
  };

  const showPreview = (next: BuildFileImportPreview): void => {
    preview = next;
    const actions = next.rotation?.length ?? 0;
    elements.fileName.textContent = next.fileName;
    renderPart(elements.buildCheckbox, elements.buildDetail, next.build && buildSummary(document, next.build));
    renderPart(
      elements.rotationCheckbox,
      elements.rotationDetail,
      next.rotation && document.createTextNode(`${actions} action${actions === 1 ? '' : 's'}`)
    );
    renderWarnings(elements.warnings, next.warnings);
    elements.parts.hidden = false;
    elements.status.classList.add('is-success');
    elements.status.textContent =
      next.build && next.rotation ? 'Choose which parts to apply.' : `Ready to apply ${next.build ? 'build' : 'rotation'}.`;
    syncApply();
  };

  const selectFile = async (file: File): Promise<void> => {
    if (loading) return;
    const current = ++generation;
    const validateDestination = captureBuildDestination(app);
    reset();
    elements.status.textContent = `Reading ${file.name}…`;
    setLoading(true);
    try {
      const saved = await readJsonFile(file);
      if (current !== generation) return;
      // An asynchronous file read cannot target a different tab selected while it was loading.
      validateDestination();
      validatePreviewDestination = validateDestination;
      showPreview(previewBuildFileImport(saved, file.name, app));
    } catch (error) {
      if (current === generation) showError(`Could not import ${file.name}.`, error);
    } finally {
      // Clear the selection so choosing the same file again still emits a change event.
      fileInput.value = '';
      if (current === generation) setLoading(false);
    }
  };

  button.addEventListener('click', () => {
    reset();
    showDialog(elements.dialog);
  });
  elements.browseButton.addEventListener('click', () => fileInput.click());
  elements.buildCheckbox.addEventListener('change', syncApply);
  elements.rotationCheckbox.addEventListener('change', syncApply);
  elements.applyButton.addEventListener('click', () => {
    if (!preview) return;
    try {
      validatePreviewDestination();
      applyBuildFileImport(app, preview, selection());
    } catch (error) {
      showError('Could not apply the import.', error);
      return;
    }

    elements.dialog.close();
  });
  elements.dialog.addEventListener('close', () => {
    generation += 1;
    preview = null;
    setLoading(false);
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void selectFile(file);
  });
  for (const eventName of ['dragenter', 'dragover']) {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add('is-dragging');
    });
  }

  elements.dropZone.addEventListener('dragleave', (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove('is-dragging');
  });
  elements.dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove('is-dragging');
    const file = event.dataTransfer?.files[0];
    if (file) void selectFile(file);
  });
}
