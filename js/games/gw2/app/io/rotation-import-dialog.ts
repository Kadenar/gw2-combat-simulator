import { bindDialog, showDialog } from '#app/dialog.js';
import { fetchJsonAsset, getRotationItems, readJsonFile } from '#gw2/app/io/files.js';
import { isJsonRotationFile, readEvtcRotationFile } from '#gw2/app/io/logs/evtc-rotation-import.js';
import {
  readDpsReportRotationData,
  readDpsReportRotationUrl,
  readWingmanRotationUrl
} from '#gw2/app/io/logs/dps-report-rotation-import.js';
import {
  bindImportFileSources,
  createImportPreviewController,
  ensureImportDialogStyles,
  importDropZoneHtml,
  renderImportNotices,
  requiredDialogPart
} from '#gw2/app/io/import-dialog.js';
import { isDpsReportData } from '#gw2/integrations/logs/dps-report/parser.js';
import { isWingmanUrl } from '#gw2/integrations/logs/wingman/url.js';
import { normalizeRotation } from '#gw2/platform/engine/execution/rotation.js';
import { ensureDocumentStyles, errorMessage } from '#ui/shared/dom.js';

import type { RotationCommand } from '#gw2/platform/engine/execution/types.js';
import type { BuildTemplatePreset } from '#gw2/app/build/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { RotationImportObservation } from '#gw2/app/io/types.js';
import type { Gw2ApplicationBuild } from '#gw2/platform/builds/types.js';

export const ROTATION_IMPORT_ACCEPT = '.json,.evtc,.evtc.zip,.zevtc,application/json,application/zip';
type RotationImportDestination = 'current' | 'reference';

export interface RotationImportPreview {
  readonly rotation: readonly RotationCommand[];
  readonly actionCount: number;
  readonly description: string;
  readonly warnings: readonly string[];
  readonly observations: readonly RotationImportObservation[];
}

interface RotationImportDialogElements {
  readonly dialog: HTMLDialogElement;
  readonly dropZone: HTMLElement;
  readonly status: HTMLElement;
  readonly error: HTMLElement;
  readonly warnings: HTMLElement;
  readonly observations: HTMLElement;
  readonly browseButton: HTMLButtonElement;
  readonly reportInput: HTMLInputElement;
  readonly reportButton: HTMLButtonElement;
  readonly presetSelect: HTMLSelectElement | null;
  readonly presetButton: HTMLButtonElement | null;
  readonly applyButton: HTMLButtonElement;
  readonly closeButton: HTMLButtonElement;
}

/** Reads and validates a rotation file without replacing the active rotation until the user applies the preview. */
export async function previewRotationFile(file: File, app: ProfessionAppState): Promise<RotationImportPreview> {
  if (isJsonRotationFile(file)) {
    const imported = await readJsonFile(file);
    const rotation = getRotationItems(imported);
    if (rotation) {
      // JSON rotations may use any historical interchange shape; app state stays canonical.
      return {
        rotation: normalizeRotation(rotation, app.activeCatalog, { strict: true }),
        actionCount: rotation.length,
        description: `Loaded ${file.name}`,
        warnings: [],
        observations: []
      };
    }

    if (isDpsReportData(imported)) {
      const report = await readDpsReportRotationData(imported, app);
      return {
        rotation: report.rotation,
        actionCount: report.actionCount,
        description: `Reconstructed ${report.playerLabel} · ${report.phaseLabel}`,
        warnings: report.warnings,
        observations: []
      };
    }

    throw new Error('Rotation array missing.');
  }

  const imported = await readEvtcRotationFile(file, app);
  return {
    rotation: imported.rotation,
    actionCount: imported.actionCount,
    description: `Reconstructed ${imported.playerLabel}`,
    warnings: imported.warnings,
    observations: imported.observations
  };
}

/** Fetches and reconstructs a dps.report rotation without replacing the active rotation before review. */
export async function previewDpsReportUrl(
  input: string,
  app: ProfessionAppState,
  fetchImplementation: typeof fetch = fetch
): Promise<RotationImportPreview> {
  const imported = await readDpsReportRotationUrl(input, app, fetchImplementation);
  return {
    rotation: imported.rotation,
    actionCount: imported.actionCount,
    description: `Reconstructed ${imported.playerLabel} · ${imported.phaseLabel}`,
    warnings: imported.warnings,
    observations: []
  };
}

/** Fetches and reconstructs a gw2wingman rotation through the same dps.report preview contract. */
export async function previewWingmanUrl(
  input: string,
  app: ProfessionAppState,
  fetchImplementation: typeof fetch = fetch
): Promise<RotationImportPreview> {
  const imported = await readWingmanRotationUrl(input, app, fetchImplementation);
  return {
    rotation: imported.rotation,
    actionCount: imported.actionCount,
    description: `Reconstructed ${imported.playerLabel} · ${imported.phaseLabel}`,
    warnings: imported.warnings,
    observations: []
  };
}

/** Loads one manifest rotation through the same strict preview boundary as uploaded JSON. */
async function previewManifestRotation(
  preset: BuildTemplatePreset,
  app: ProfessionAppState
): Promise<RotationImportPreview> {
  if (!preset.rotation) throw new Error('Rotation asset missing.');
  const items = getRotationItems(await fetchJsonAsset(preset.rotation));
  if (!items) throw new Error('Rotation array missing.');
  const rotation = normalizeRotation(items, app.activeCatalog, { strict: true });
  const name = preset.section ? `${preset.section} · ${preset.label}` : preset.label;
  return {
    rotation,
    actionCount: rotation.length,
    description: `Loaded ${name}`,
    warnings: [],
    observations: []
  };
}

export interface ManifestBuildEntry {
  readonly preset: BuildTemplatePreset;
  readonly build: unknown;
}

// Keyed by the template list itself: re-rendering templates replaces the array, which invalidates the cache.
const manifestBuildCache = new WeakMap<
  readonly BuildTemplatePreset[],
  Promise<readonly (ManifestBuildEntry | null)[]>
>();

/**
 * Fetches the build of every preset that has a rotation, once per template list.
 *
 * The reference dialog is rebuilt on every comparison entry, so loading lazily and caching avoids re-downloading the
 * whole manifest each time. A preset whose build cannot be loaded resolves to null, and a list with any failure is
 * fetched again on the next call.
 */
export function loadManifestBuilds(
  presets: readonly BuildTemplatePreset[],
  fetchAsset: (path: string) => Promise<unknown> = fetchJsonAsset
): Promise<readonly (ManifestBuildEntry | null)[]> {
  const cached = manifestBuildCache.get(presets);
  if (cached) return cached;
  const loading = Promise.all(
    presets
      .filter((preset) => preset.rotation)
      .map(async (preset) => {
        try {
          return { preset, build: await fetchAsset(preset.build) };
        } catch {
          return null;
        }
      })
  );
  manifestBuildCache.set(presets, loading);
  // A failure may be a network blip; forget it so the next open retries instead of hiding that preset.
  void loading.then((entries) => {
    if (entries.includes(null) && manifestBuildCache.get(presets) === loading) manifestBuildCache.delete(presets);
  });
  return loading;
}

function selectedSkillNames(build: unknown): string[] | null {
  if (!build || typeof build !== 'object' || Array.isArray(build)) return null;
  const selectedSkills = (build as { selectedSkills?: unknown }).selectedSkills;
  if (!selectedSkills || typeof selectedSkills !== 'object' || Array.isArray(selectedSkills)) return null;
  const names = Object.values(selectedSkills);
  return names.every((name) => typeof name === 'string') ? names.filter(Boolean).sort() : null;
}

/** Keeps manifest references compatible with the active profession and selected skill loadout. */
export function manifestRotationMatchesBuild(build: unknown, currentBuild: Gw2ApplicationBuild): boolean {
  if (!build || typeof build !== 'object' || Array.isArray(build)) return false;
  const candidate = build as { profession?: unknown };
  const candidateSkills = selectedSkillNames(build);
  const currentSkills = selectedSkillNames(currentBuild);
  return (
    candidate.profession === currentBuild.profession &&
    candidateSkills !== null &&
    currentSkills !== null &&
    candidateSkills.length === currentSkills.length &&
    candidateSkills.every((name, index) => name === currentSkills[index])
  );
}

/** Replaces the active rotation only after the user accepts a successfully reconstructed preview. */
export function applyRotationImportPreview(app: ProfessionAppState, preview: RotationImportPreview): void {
  app.build.rotation = [...preview.rotation];
  app.changed(false);
}

const ROTATION_IMPORT_STYLES = `
    .rotation-import-dialog .import-dialog-drop { min-height:150px; }
    .rotation-import-experimental { margin:0 0 14px; padding:8px 10px; border:1px solid #a67c22;
      border-radius:5px; background:rgba(166,124,34,.1); color:#e0bd68; font-size:11px; line-height:1.45; }
    .rotation-import-report { display:flex; gap:6px; margin-top:10px; }
    .rotation-import-report input { min-width:0; flex:1; padding:7px 9px; border:1px solid var(--border-light);
      border-radius:5px; background:var(--bg-panel-alt); color:var(--text); }
    .rotation-import-preset { display:flex; gap:6px; margin-top:10px; }
    .rotation-import-preset select { min-width:0; flex:1; padding:7px 9px; border:1px solid var(--border-light);
      border-radius:5px; background:var(--bg-panel-alt); color:var(--text); }
    .rotation-import-observations { display:grid; gap:6px; margin:10px 0 0; padding:0; list-style:none; font-size:11px; }
    .rotation-import-observations li { padding:9px 10px; border:1px solid var(--border);
      border-radius:5px; background:rgba(102,170,255,.06); line-height:1.45; }
    .rotation-import-observations strong { display:block; margin-bottom:2px; color:var(--text-bright); }
    .rotation-import-observation-summary { color:var(--text); }
    .rotation-import-observation-detail { display:block; margin-top:4px; color:var(--text-dim); }
  `;

function createDialog(document: Document, destination: RotationImportDestination): RotationImportDialogElements {
  ensureImportDialogStyles(document);
  ensureDocumentStyles(document, 'rotation-import-styles', ROTATION_IMPORT_STYLES);
  const reference = destination === 'reference';
  const titleId = `rotation-import-title-${destination}`;
  const dialog = document.createElement('dialog');
  dialog.className = 'rotation-import-dialog';
  dialog.dataset.rotationImportDestination = destination;
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.innerHTML = `<form class="import-dialog-form app-dialog-body" method="dialog">
    <h3 id="${titleId}">${reference ? 'Load reference rotation' : 'Load rotation'}</h3>
    <p class="import-dialog-intro">Load a saved rotation JSON, reconstruct an ArcDPS EVTC log, or import the Elite Insights casts from a dps.report or gw2wingman link.</p>
    <p class="rotation-import-experimental"><strong>Experimental:</strong> Combat-log import may produce incomplete or inaccurate rotations. dps.report and gw2wingman omit some raw EVTC evidence, so review the imported rotation before relying on it.</p>
    ${importDropZoneHtml('rotation-import', 'Drop a rotation or combat log here', '.json · .evtc · .evtc.zip · .zevtc')}
    <div class="rotation-import-report">
      <input type="url" inputmode="url" placeholder="https://dps.report/… or https://gw2wingman.…/log/…" aria-label="dps.report or gw2wingman link" data-rotation-import-report-input>
      <button type="button" class="btn btn-io" data-rotation-import-report>Import link</button>
    </div>
    ${
      reference
        ? `<div class="rotation-import-preset">
      <select aria-label="Existing rotation" data-rotation-import-preset></select>
      <button type="button" class="btn btn-io" data-rotation-import-preset-load>Load selected</button>
    </div>`
        : ''
    }
    <p class="import-dialog-status" role="status" data-rotation-import-status>Select a file or enter a link to begin.</p>
    <p class="import-dialog-error" role="alert" data-rotation-import-error hidden></p>
    <ul class="import-dialog-notices" aria-label="Import notices" data-rotation-import-warnings hidden></ul>
    <ul class="rotation-import-observations" aria-label="Combat log observations" data-rotation-import-observations hidden></ul>
    <div class="app-dialog-actions">
      <button type="button" class="btn" data-dialog-close>Cancel</button>
      <button type="button" class="btn btn-io import-dialog-apply" data-rotation-import-apply disabled>${reference ? 'Use as reference' : 'Apply rotation'}</button>
    </div>
  </form>`;
  bindDialog(dialog);
  document.body.append(dialog);

  return {
    dialog,
    dropZone: requiredDialogPart(dialog, '[data-rotation-import-drop]'),
    status: requiredDialogPart(dialog, '[data-rotation-import-status]'),
    error: requiredDialogPart(dialog, '[data-rotation-import-error]'),
    warnings: requiredDialogPart(dialog, '[data-rotation-import-warnings]'),
    observations: requiredDialogPart(dialog, '[data-rotation-import-observations]'),
    browseButton: requiredDialogPart(dialog, '[data-rotation-import-browse]'),
    reportInput: requiredDialogPart(dialog, '[data-rotation-import-report-input]'),
    reportButton: requiredDialogPart(dialog, '[data-rotation-import-report]'),
    presetSelect: dialog.querySelector<HTMLSelectElement>('[data-rotation-import-preset]'),
    presetButton: dialog.querySelector<HTMLButtonElement>('[data-rotation-import-preset-load]'),
    applyButton: requiredDialogPart(dialog, '[data-rotation-import-apply]'),
    closeButton: requiredDialogPart(dialog, '[data-dialog-close]')
  };
}

/** Renders read-only combat-log evidence separately from reconstruction warnings. */
function renderObservations(list: HTMLElement, observations: readonly RotationImportObservation[]): void {
  const document = list.ownerDocument;
  list.replaceChildren(
    ...observations.map((observation) => {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      const summary = document.createElement('div');
      const detail = document.createElement('small');
      title.textContent = observation.title;
      summary.className = 'rotation-import-observation-summary';
      summary.textContent = observation.summary;
      detail.className = 'rotation-import-observation-detail';
      detail.textContent = observation.detail;
      item.append(title, summary, detail);
      return item;
    })
  );
  list.hidden = observations.length === 0;
}

/** Connects a rotation destination to JSON, EVTC, dps.report, and optional manifest previews. */
export function bindRotationImportDialog(
  app: ProfessionAppState,
  button: HTMLElement,
  fileInput: HTMLInputElement,
  destination: RotationImportDestination = 'current'
): void {
  fileInput.accept = ROTATION_IMPORT_ACCEPT;
  button.setAttribute('aria-haspopup', 'dialog');
  button.title = 'Load a rotation JSON or reconstruct one from an EVTC/dps.report/gw2wingman log';

  const elements = createDialog(button.ownerDocument, destination);
  let manifestRotations: BuildTemplatePreset[] = [];
  let manifestGeneration = 0;
  let importing = false;
  let activePreview: RotationImportPreview | null = null;

  const clearNotices = (): void => {
    elements.error.hidden = true;
    elements.error.textContent = '';
    renderImportNotices(elements.warnings, []);
    renderObservations(elements.observations, []);
  };

  const resetMessages = (): void => {
    activePreview = null;
    elements.applyButton.disabled = true;
    elements.status.classList.remove('is-success');
    elements.status.textContent =
      destination === 'reference'
        ? 'Select a file, enter a link, or choose an existing rotation.'
        : 'Select a file or enter a link to begin.';
    clearNotices();
  };

  const importer = createImportPreviewController<RotationImportPreview>(app, {
    begin(message) {
      activePreview = null;
      elements.status.classList.remove('is-success');
      elements.status.textContent = message;
      clearNotices();
    },
    ready(preview) {
      activePreview = preview;
      elements.status.classList.add('is-success');
      elements.status.textContent = `Ready to apply: ${preview.description} (${preview.actionCount} action${preview.actionCount === 1 ? '' : 's'}).`;
      renderImportNotices(elements.warnings, preview.warnings);
      renderObservations(elements.observations, preview.observations);
    },
    fail(message, error) {
      elements.status.textContent = message;
      elements.error.hidden = false;
      elements.error.textContent = errorMessage(error);
    },
    setLoading(value) {
      importing = value;
      elements.browseButton.disabled = value;
      elements.reportButton.disabled = value;
      elements.reportInput.disabled = value;
      if (elements.presetSelect) elements.presetSelect.disabled = value || !manifestRotations.length;
      if (elements.presetButton) elements.presetButton.disabled = value || !elements.presetSelect?.value;
      elements.closeButton.disabled = value;
      elements.applyButton.disabled = value || !activePreview;
    },
    settled() {
      fileInput.value = '';
    }
  });

  const populateManifestRotations = async (): Promise<void> => {
    const { presetSelect, presetButton } = elements;
    if (!presetSelect || !presetButton) return;
    const request = ++manifestGeneration;
    presetSelect.disabled = true;
    presetButton.disabled = true;
    const placeholder = button.ownerDocument.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Loading compatible rotations…';
    presetSelect.replaceChildren(placeholder);
    // Builds download on first open only; later opens and comparison re-entries reuse them.
    const entries = await loadManifestBuilds(app.templatePresets);
    // A reopen while loading repopulates the list; drop this older result instead of appending duplicates.
    if (request !== manifestGeneration) return;
    manifestRotations = entries
      .filter((entry): entry is ManifestBuildEntry => entry !== null)
      .filter((entry) => manifestRotationMatchesBuild(entry.build, app.build))
      .map((entry) => entry.preset);
    placeholder.textContent = manifestRotations.length ? 'Choose a compatible rotation…' : 'No compatible rotations';
    manifestRotations.forEach((preset, index) => {
      const option = button.ownerDocument.createElement('option');
      option.value = String(index);
      option.textContent = preset.section ? `${preset.section} · ${preset.label}` : preset.label;
      presetSelect.append(option);
    });
    presetSelect.disabled = importing || !manifestRotations.length;
  };

  const selectFile = (file: File): void => {
    void importer.load(() => previewRotationFile(file, app), `Reading ${file.name}…`, `Could not import ${file.name}.`);
  };

  const selectReport = async (): Promise<void> => {
    const input = elements.reportInput.value.trim();
    if (importing || !input) return;
    const wingman = isWingmanUrl(input);
    await importer.load(
      () => (wingman ? previewWingmanUrl(input, app) : previewDpsReportUrl(input, app)),
      wingman ? 'Fetching gw2wingman…' : 'Fetching dps.report…',
      wingman ? 'Could not import the gw2wingman link.' : 'Could not import the dps.report link.'
    );
  };

  const selectPreset = async (): Promise<void> => {
    if (importing || !elements.presetSelect?.value) return;
    const preset = manifestRotations[Number(elements.presetSelect.value)];
    if (!preset) return;
    await importer.load(
      () => previewManifestRotation(preset, app),
      'Loading existing rotation…',
      'Could not load the existing rotation.'
    );
  };

  button.addEventListener('click', () => {
    resetMessages();
    showDialog(elements.dialog);
    void populateManifestRotations();
  });
  bindImportFileSources(elements.dropZone, elements.browseButton, fileInput, selectFile);
  elements.reportButton.addEventListener('click', () => void selectReport());
  elements.reportInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void selectReport();
  });
  elements.presetSelect?.addEventListener('change', () => {
    if (elements.presetButton) elements.presetButton.disabled = !elements.presetSelect?.value;
  });
  elements.presetButton?.addEventListener('click', () => void selectPreset());
  elements.applyButton.addEventListener('click', () => {
    if (!activePreview) return;
    try {
      importer.validateDestination();
    } catch (error) {
      resetMessages();
      elements.error.hidden = false;
      elements.error.textContent = errorMessage(error);
      return;
    }

    if (destination === 'reference') app.loadRotationReference(activePreview.rotation);
    else applyRotationImportPreview(app, activePreview);
    activePreview = null;
    elements.dialog.close();
  });
  elements.dialog.addEventListener('close', () => {
    activePreview = null;
    importer.cancel();
  });
}
