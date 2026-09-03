import { fetchJsonAsset, getRotationItems, readJsonFile } from '#gw2/app/build/io/files.js';
import { isJsonRotationFile, readEvtcRotationFile } from '#gw2/app/build/io/evtc-rotation-import.js';
import { readDpsReportRotationData, readDpsReportRotationUrl } from '#gw2/app/build/io/dps-report-rotation-import.js';
import { isDpsReportData } from '#gw2/integrations/logs/dps-report/parser.js';
import { normalizeRotation } from '#gw2/platform/engine/execution/rotation.js';
import { errorMessage } from '#ui/shared/dom.js';

import type { RotationCommand } from '#gw2/platform/engine/types.js';
import type { BuildTemplatePreset, ProfessionAppState } from '#gw2/app/types.js';
import type { RotationImportObservation } from '#gw2/app/build/io/rotation-import-model.js';
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

function ensureStyles(document: Document): void {
  if (document.getElementById('rotation-import-styles')) return;
  const style = document.createElement('style');
  style.id = 'rotation-import-styles';
  style.textContent = `
    .rotation-import-dialog { position:fixed; inset:0; width:min(560px, calc(100vw - 32px));
      max-height:calc(100vh - 32px); margin:auto; padding:0; overflow:auto;
      border:1px solid var(--border-light); border-radius:8px; background:var(--bg-panel);
      color:var(--text); box-shadow:0 18px 60px rgba(0,0,0,.65); }
    .rotation-import-dialog::backdrop { background:rgba(5,7,12,.78); }
    .rotation-import-form { padding:18px; }
    .rotation-import-form h3 { margin:0 0 6px; color:var(--text-bright); }
    .rotation-import-intro { margin:0 0 14px; color:var(--text-dim); font-size:12px; line-height:1.5; }
    .rotation-import-experimental { margin:0 0 14px; padding:8px 10px; border:1px solid #a67c22;
      border-radius:5px; background:rgba(166,124,34,.1); color:#e0bd68; font-size:11px; line-height:1.45; }
    .rotation-import-drop { display:flex; min-height:150px; padding:20px; align-items:center;
      justify-content:center; border:2px dashed var(--border-light); border-radius:8px;
      background:var(--bg-panel-alt); text-align:center; transition:border-color .15s, background .15s; }
    .rotation-import-drop.is-dragging { border-color:var(--accent); background:rgba(102,170,255,.08); }
    .rotation-import-drop strong { display:block; margin-bottom:5px; color:var(--text-bright); font-size:13px; }
    .rotation-import-drop small { display:block; margin:8px 0; color:var(--text-dim); font-size:10px; }
    .rotation-import-report { display:flex; gap:6px; margin-top:10px; }
    .rotation-import-report input { min-width:0; flex:1; padding:7px 9px; border:1px solid var(--border-light);
      border-radius:5px; background:var(--bg-input); color:var(--text); }
    .rotation-import-preset { display:flex; gap:6px; margin-top:10px; }
    .rotation-import-preset select { min-width:0; flex:1; padding:7px 9px; border:1px solid var(--border-light);
      border-radius:5px; background:var(--bg-input); color:var(--text); }
    .rotation-import-status { margin:12px 0 0; color:var(--text-dim); font-size:12px; }
    .rotation-import-status.is-success { color:var(--health); }
    .rotation-import-error { margin:12px 0 0; color:var(--condi); font-size:12px; white-space:pre-wrap; }
    .rotation-import-warnings { margin:10px 0 0; color:var(--text-dim); font-size:11px; }
    .rotation-import-warning-list { display:grid; gap:6px; margin:0; padding:0; list-style:none; }
    .rotation-import-warning-list li { padding:8px 10px; border:1px solid var(--border);
      border-left:3px solid #a67c22; border-radius:5px; background:rgba(166,124,34,.06); line-height:1.45; }
    .rotation-import-warning-list strong { display:block; margin-bottom:2px; color:var(--text-bright); }
    .rotation-import-observations { margin:10px 0 0; font-size:11px; }
    .rotation-import-observation-list { display:grid; gap:6px; margin:0; padding:0; list-style:none; }
    .rotation-import-observation-list li { padding:9px 10px; border:1px solid var(--border);
      border-left:3px solid var(--accent); border-radius:5px; background:rgba(102,170,255,.06); line-height:1.45; }
    .rotation-import-observation-list strong { display:block; margin-bottom:2px; color:var(--text-bright); }
    .rotation-import-observation-summary { color:var(--text); }
    .rotation-import-observation-detail { display:block; margin-top:4px; color:var(--text-dim); }
    .rotation-import-actions { display:flex; justify-content:flex-end; gap:6px; margin-top:14px; }
    .rotation-import-actions [data-rotation-import-apply]:disabled { opacity:.45; cursor:not-allowed; }
  `;
  document.head.append(style);
}

function createDialog(document: Document, destination: RotationImportDestination): RotationImportDialogElements {
  ensureStyles(document);
  const reference = destination === 'reference';
  const titleId = `rotation-import-title-${destination}`;
  const dialog = document.createElement('dialog');
  dialog.className = 'rotation-import-dialog';
  dialog.dataset.rotationImportDestination = destination;
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.innerHTML = `<form class="rotation-import-form" method="dialog">
    <h3 id="${titleId}">${reference ? 'Load reference rotation' : 'Load rotation'}</h3>
    <p class="rotation-import-intro">Load a saved rotation JSON, reconstruct an ArcDPS EVTC log, or import the Elite Insights casts from a dps.report link.</p>
    <p class="rotation-import-experimental"><strong>Experimental:</strong> Combat-log import may produce incomplete or inaccurate rotations. dps.report omits some raw EVTC evidence, so review the imported rotation before relying on it.</p>
    <div class="rotation-import-drop" data-rotation-import-drop>
      <div>
        <strong>Drop a rotation or combat log here</strong>
        <small>.json · .evtc · .evtc.zip · .zevtc</small>
        <button type="button" class="btn btn-io" data-rotation-import-browse>Browse files</button>
      </div>
    </div>
    <div class="rotation-import-report">
      <input type="url" inputmode="url" placeholder="https://dps.report/…" aria-label="dps.report link" data-rotation-import-report-input>
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
    <p class="rotation-import-status" role="status" data-rotation-import-status>Select a file or enter a link to begin.</p>
    <p class="rotation-import-error" role="alert" data-rotation-import-error hidden></p>
    <div class="rotation-import-warnings" aria-label="Import notices" data-rotation-import-warnings hidden></div>
    <div class="rotation-import-observations" aria-label="Combat log observations" data-rotation-import-observations hidden></div>
    <div class="rotation-import-actions">
      <button type="button" class="btn" data-rotation-import-close>Cancel</button>
      <button type="button" class="btn btn-io" data-rotation-import-apply disabled>${reference ? 'Use as reference' : 'Apply rotation'}</button>
    </div>
  </form>`;
  document.body.append(dialog);

  const dropZone = dialog.querySelector<HTMLElement>('[data-rotation-import-drop]');
  const status = dialog.querySelector<HTMLElement>('[data-rotation-import-status]');
  const error = dialog.querySelector<HTMLElement>('[data-rotation-import-error]');
  const warnings = dialog.querySelector<HTMLElement>('[data-rotation-import-warnings]');
  const observations = dialog.querySelector<HTMLElement>('[data-rotation-import-observations]');
  const browseButton = dialog.querySelector<HTMLButtonElement>('[data-rotation-import-browse]');
  const reportInput = dialog.querySelector<HTMLInputElement>('[data-rotation-import-report-input]');
  const reportButton = dialog.querySelector<HTMLButtonElement>('[data-rotation-import-report]');
  const presetSelect = dialog.querySelector<HTMLSelectElement>('[data-rotation-import-preset]');
  const presetButton = dialog.querySelector<HTMLButtonElement>('[data-rotation-import-preset-load]');
  const applyButton = dialog.querySelector<HTMLButtonElement>('[data-rotation-import-apply]');
  const closeButton = dialog.querySelector<HTMLButtonElement>('[data-rotation-import-close]');
  if (
    !dropZone ||
    !status ||
    !error ||
    !warnings ||
    !observations ||
    !browseButton ||
    !reportInput ||
    !reportButton ||
    !applyButton ||
    !closeButton
  ) {
    throw new Error('Rotation import dialog failed to initialize.');
  }

  return {
    dialog,
    dropZone,
    status,
    error,
    warnings,
    observations,
    browseButton,
    reportInput,
    reportButton,
    presetSelect,
    presetButton,
    applyButton,
    closeButton
  };
}

/** Renders technical import notices as labeled items that can be scanned independently. */
function renderWarnings(element: HTMLElement, warnings: readonly string[]): void {
  element.replaceChildren();
  const list = element.ownerDocument.createElement('ul');
  list.className = 'rotation-import-warning-list';
  for (const warning of warnings) {
    const item = element.ownerDocument.createElement('li');
    const separator = warning.indexOf(':');
    if (separator > 0 && separator < 40) {
      const label = element.ownerDocument.createElement('strong');
      label.textContent = warning.slice(0, separator);
      item.append(label, warning.slice(separator + 1).trim());
    } else {
      item.textContent = warning;
    }

    list.append(item);
  }

  element.append(list);
}

/** Renders read-only combat-log evidence separately from reconstruction warnings. */
function renderObservations(element: HTMLElement, observations: readonly RotationImportObservation[]): void {
  element.replaceChildren();
  const list = element.ownerDocument.createElement('ul');
  list.className = 'rotation-import-observation-list';
  for (const observation of observations) {
    const item = element.ownerDocument.createElement('li');
    const title = element.ownerDocument.createElement('strong');
    const summary = element.ownerDocument.createElement('div');
    const detail = element.ownerDocument.createElement('small');
    title.textContent = observation.title;
    summary.className = 'rotation-import-observation-summary';
    summary.textContent = observation.summary;
    detail.className = 'rotation-import-observation-detail';
    detail.textContent = observation.detail;
    item.append(title, summary, detail);
    list.append(item);
  }

  element.append(list);
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
  button.title = 'Load a rotation JSON or reconstruct one from an EVTC/dps.report log';

  const elements = createDialog(button.ownerDocument, destination);
  const manifestCandidates = destination === 'reference' ? app.templatePresets.filter((preset) => preset.rotation) : [];
  const manifestBuilds = Promise.all(
    manifestCandidates.map(async (preset) => {
      try {
        return { preset, build: await fetchJsonAsset(preset.build) };
      } catch {
        return null;
      }
    })
  );
  let manifestRotations: BuildTemplatePreset[] = [];
  if (elements.presetSelect && elements.presetButton) {
    const placeholder = button.ownerDocument.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Loading compatible rotations…';
    elements.presetSelect.append(placeholder);
    elements.presetSelect.disabled = true;
    elements.presetButton.disabled = true;
  }

  let importing = false;
  let activePreview: RotationImportPreview | null = null;

  const resetMessages = (): void => {
    activePreview = null;
    elements.applyButton.disabled = true;
    elements.status.classList.remove('is-success');
    elements.status.textContent =
      destination === 'reference'
        ? 'Select a file, enter a link, or choose an existing rotation.'
        : 'Select a file or enter a link to begin.';
    elements.error.hidden = true;
    elements.error.textContent = '';
    elements.warnings.hidden = true;
    elements.warnings.replaceChildren();
    elements.observations.hidden = true;
    elements.observations.replaceChildren();
  };

  const setImporting = (value: boolean): void => {
    importing = value;
    elements.browseButton.disabled = value;
    elements.reportButton.disabled = value;
    elements.reportInput.disabled = value;
    if (elements.presetSelect) elements.presetSelect.disabled = value || !manifestRotations.length;
    if (elements.presetButton) {
      elements.presetButton.disabled = value || !elements.presetSelect?.value;
    }

    elements.closeButton.disabled = value;
    elements.applyButton.disabled = value || !activePreview;
  };

  const populateManifestRotations = async (): Promise<void> => {
    if (!elements.presetSelect || !elements.presetButton) return;
    elements.presetSelect.disabled = true;
    elements.presetButton.disabled = true;
    const placeholder = button.ownerDocument.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Loading compatible rotations…';
    elements.presetSelect.replaceChildren(placeholder);
    manifestRotations = (await manifestBuilds)
      .filter((entry) => entry && manifestRotationMatchesBuild(entry.build, app.build))
      .map((entry) => entry!.preset);
    placeholder.textContent = manifestRotations.length ? 'Choose a compatible rotation…' : 'No compatible rotations';
    manifestRotations.forEach((preset, index) => {
      const option = button.ownerDocument.createElement('option');
      option.value = String(index);
      option.textContent = preset.section ? `${preset.section} · ${preset.label}` : preset.label;
      elements.presetSelect?.append(option);
    });
    elements.presetSelect.disabled = !manifestRotations.length;
  };

  const showReadyPreview = (imported: RotationImportPreview): void => {
    activePreview = imported;
    elements.status.classList.add('is-success');
    elements.status.textContent = `Ready to apply: ${imported.description} (${imported.actionCount} action${imported.actionCount === 1 ? '' : 's'}).`;
    elements.warnings.hidden = imported.warnings.length === 0;
    renderWarnings(elements.warnings, imported.warnings);
    elements.observations.hidden = imported.observations.length === 0;
    renderObservations(elements.observations, imported.observations);
  };

  const selectFile = async (file: File): Promise<void> => {
    if (importing) return;
    activePreview = null;
    setImporting(true);
    elements.status.classList.remove('is-success');
    elements.status.textContent = `Reading ${file.name}…`;
    elements.error.hidden = true;
    elements.warnings.hidden = true;
    elements.observations.hidden = true;
    try {
      showReadyPreview(await previewRotationFile(file, app));
    } catch (error) {
      elements.status.textContent = `Could not import ${file.name}.`;
      elements.error.hidden = false;
      elements.error.textContent = errorMessage(error);
    } finally {
      fileInput.value = '';
      setImporting(false);
    }
  };

  const selectReport = async (): Promise<void> => {
    if (importing) return;
    const input = elements.reportInput.value.trim();
    if (!input) return;
    activePreview = null;
    setImporting(true);
    elements.status.classList.remove('is-success');
    elements.status.textContent = 'Fetching dps.report…';
    elements.error.hidden = true;
    elements.warnings.hidden = true;
    elements.observations.hidden = true;
    try {
      showReadyPreview(await previewDpsReportUrl(input, app));
    } catch (error) {
      elements.status.textContent = 'Could not import the dps.report link.';
      elements.error.hidden = false;
      elements.error.textContent = errorMessage(error);
    } finally {
      setImporting(false);
    }
  };

  const selectPreset = async (): Promise<void> => {
    if (importing || !elements.presetSelect?.value) return;
    const preset = manifestRotations[Number(elements.presetSelect.value)];
    if (!preset) return;
    activePreview = null;
    setImporting(true);
    elements.status.classList.remove('is-success');
    elements.status.textContent = 'Loading existing rotation…';
    elements.error.hidden = true;
    elements.warnings.hidden = true;
    elements.observations.hidden = true;
    try {
      showReadyPreview(await previewManifestRotation(preset, app));
    } catch (error) {
      elements.status.textContent = 'Could not load the existing rotation.';
      elements.error.hidden = false;
      elements.error.textContent = errorMessage(error);
    } finally {
      setImporting(false);
    }
  };

  button.addEventListener('click', () => {
    resetMessages();
    elements.dialog.showModal();
    void populateManifestRotations();
  });
  elements.browseButton.addEventListener('click', () => fileInput.click());
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
    if (destination === 'reference') app.loadRotationReference(activePreview.rotation);
    else applyRotationImportPreview(app, activePreview);
    activePreview = null;
    elements.dialog.close();
  });
  elements.closeButton.addEventListener('click', () => elements.dialog.close());
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
