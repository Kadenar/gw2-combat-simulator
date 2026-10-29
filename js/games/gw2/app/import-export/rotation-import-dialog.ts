import { bindDialog, showDialog } from '#browser/page/dialog.js';
import type { BuildTemplatePreset } from '#gw2/app/build/types.js';
import {
  buildTransitionDelayNotices,
  readBuildTransitionDelays
} from '#gw2/app/import-export/build-transition-delays.js';
import { readJsonFile } from '#gw2/app/import-export/files.js';
import {
  bindImportFileSources,
  createImportPreviewController,
  ensureImportDialogStyles,
  importDropZoneHtml,
  renderImportNotices,
  requiredDialogPart
} from '#gw2/app/import-export/import-dialog.js';
import {
  readDpsReportRotationData,
  readDpsReportRotationUrl,
  readWingmanRotationUrl
} from '#gw2/app/import-export/logs/dps-report-rotation-import.js';
import { isJsonRotationFile, readEvtcRotationFile } from '#gw2/app/import-export/logs/evtc-rotation-import.js';
import type { RotationImportObservation } from '#gw2/app/import-export/types.js';
import type { RotationReferenceDescriptor } from '#gw2/app/rotation/comparison-state.js';
import { applyTransitionDelays } from '#gw2/app/simulation/settings.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { fetchJsonAsset, getRotationItems } from '#gw2/integrations/assets.js';
import { isDpsReportData } from '#gw2/integrations/logs/dps-report/parser.js';
import { isWingmanUrl } from '#gw2/integrations/logs/wingman/url.js';
import { normalizeRotation } from '#gw2/platform/builds/rotation.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { TransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import { ensureDocumentStyles } from '#ui/shared/dom.js';
import { errorMessage } from '#ui/shared/errors.js';

const ROTATION_IMPORT_ACCEPT = '.json,.evtc,.evtc.zip,.zevtc,application/json,application/zip';
type RotationImportDestination = 'current' | 'reference';
type RotationImportSource = 'saved' | 'file' | 'link';

export interface RotationImportPreview {
  readonly transitionDelays?: TransitionDelays | null;
  readonly reference?: RotationReferenceDescriptor;
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
  readonly presetSelect: HTMLSelectElement | null;
  readonly sourceTabs: readonly HTMLButtonElement[];
  readonly sourcePanels: readonly HTMLElement[];
  readonly fileName: HTMLElement;
  readonly applyButton: HTMLButtonElement;
  readonly closeButton: HTMLButtonElement;
}

/** Validate imported command identities against the active catalog before applying the rotation. */
function normalizeImportedRotation(items: readonly unknown[], app: ProfessionAppState): RotationCommand[] {
  return normalizeRotation(items, app.activeCatalog, { strict: true });
}

/** Reads and validates a rotation file without replacing the active rotation until the user applies the preview. */
export async function previewRotationFile(file: File, app: ProfessionAppState): Promise<RotationImportPreview> {
  if (isJsonRotationFile(file)) {
    const imported = await readJsonFile(file);
    const rotation = getRotationItems(imported);

    if (rotation) {
      const transitionDelays = readBuildTransitionDelays(imported);
      // Unique authored names are decoded at this boundary; ambiguous variants require explicit IDs.
      return {
        transitionDelays,
        rotation: normalizeImportedRotation(rotation, app),
        actionCount: rotation.length,
        description: `Loaded ${file.name}`,
        warnings: buildTransitionDelayNotices(transitionDelays, app),
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
async function previewWingmanUrl(input: string, app: ProfessionAppState): Promise<RotationImportPreview> {
  const imported = await readWingmanRotationUrl(input, app);
  return {
    rotation: imported.rotation,
    actionCount: imported.actionCount,
    description: `Reconstructed ${imported.playerLabel} · ${imported.phaseLabel}`,
    warnings: imported.warnings,
    observations: []
  };
}

/** Loads one manifest rotation through the same strict preview boundary as uploaded JSON. */
export async function previewManifestRotation(
  preset: BuildTemplatePreset,
  app: ProfessionAppState
): Promise<RotationImportPreview> {
  if (!preset.rotation) throw new Error('Rotation asset missing.');

  // Recheck the saved build at load time so a stale selection cannot bypass the compatibility filter.
  const build = await fetchJsonAsset(preset.build);

  if (!manifestRotationMatchesBuild(build, app.build, app.activeCatalog)) {
    throw new Error(
      'Saved rotation must match your profession, specialization, equipped weapons, and selected skills.'
    );
  }

  const savedRotation = await fetchJsonAsset(preset.rotation);
  const items = getRotationItems(savedRotation);
  const transitionDelays = readBuildTransitionDelays(savedRotation);

  if (!items) throw new Error('Rotation array missing.');

  const rotation = normalizeImportedRotation(items, app);
  const name = preset.section ? `${preset.section} · ${preset.label}` : preset.label;
  return {
    rotation,
    transitionDelays,
    actionCount: rotation.length,
    description: `Loaded ${name}`,
    // Keep manifest context across shared-config refreshes; published figures never become event evidence.
    reference: {
      label: name,
      warnings: [],
      publishedBenchmarks: {
        ...(preset.benchmarkDps == null ? {} : { current: preset.benchmarkDps }),
        ...(preset.patchPreview ? { [preset.patchPreview.patchId]: preset.patchPreview.benchmarkDps } : {})
      }
    },
    warnings: buildTransitionDelayNotices(transitionDelays, app),
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

function selectedSkillIds(build: unknown): (string | number)[] | null {
  if (!build || typeof build !== 'object' || Array.isArray(build)) return null;

  const selectedSkillIds = (build as { selectedSkillIds?: unknown }).selectedSkillIds;

  if (!selectedSkillIds || typeof selectedSkillIds !== 'object' || Array.isArray(selectedSkillIds)) return null;

  const ids = Object.values(selectedSkillIds);
  // Sorting includes the ID type so numeric and string identities stay distinct across slot orderings.
  return ids.every((id) => id === null || typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id)))
    ? ids.filter((id) => id !== null).sort((a, b) => `${typeof a}:${a}`.localeCompare(`${typeof b}:${b}`))
    : null;
}

/** Resolves elite identity from known trait lines without requiring identical core lines or trait choices. */
function manifestSpecialization(selections: unknown, catalog: CanonicalCatalog): string | null {
  if (!Array.isArray(selections) || selections.length !== 3) return null;

  const lines = selections.map((selection) => catalog.specializations.find((line) => line.name === selection?.name));

  if (lines.some((line) => !line)) return null;

  const elites = lines.filter((line) => line?.elite);
  return elites.length > 1 ? null : (elites[0]?.name ?? 'Core');
}

/** Weapon slots and set order must match because imported swap commands reuse the current build's equipment. */
function manifestWeaponsMatch(weapons: unknown, current: readonly string[]): boolean {
  return (
    Array.isArray(weapons) && weapons.length === current.length && weapons.every((weapon, i) => weapon === current[i])
  );
}

/** Keeps references within the same elite specialization, weapon sets, and selected skill loadout. */
export function manifestRotationMatchesBuild(
  build: unknown,
  currentBuild: Gw2CanonicalBuild,
  catalog: CanonicalCatalog
): boolean {
  if (!build || typeof build !== 'object' || Array.isArray(build)) return false;

  const candidate = build as {
    profession?: unknown;
    specializations?: unknown;
    weapons?: unknown;
    alternateWeapons?: unknown;
  };
  const specialization = manifestSpecialization(candidate.specializations, catalog);
  const candidateSkills = selectedSkillIds(build);
  const currentSkills = selectedSkillIds(currentBuild);
  return (
    candidate.profession === currentBuild.profession &&
    specialization !== null &&
    specialization === manifestSpecialization(currentBuild.specializations, catalog) &&
    manifestWeaponsMatch(candidate.weapons, currentBuild.weapons) &&
    manifestWeaponsMatch(candidate.alternateWeapons, currentBuild.alternateWeapons) &&
    candidateSkills !== null &&
    currentSkills !== null &&
    candidateSkills.length === currentSkills.length &&
    candidateSkills.every((id, index) => id === currentSkills[index])
  );
}

/** Replaces the active rotation only after the user accepts a successfully reconstructed preview. */
export function applyRotationImportPreview(app: ProfessionAppState, preview: RotationImportPreview): void {
  app.build.rotation = structuredClone([...preview.rotation]);
  const settingsChanged = applyTransitionDelays(app, preview.transitionDelays ?? null);
  app.changed(settingsChanged);
}

const ROTATION_IMPORT_STYLES = `
    /* Keep source selection and review in one shell with a stable footer across all three sources. */
    .rotation-import-dialog { --dialog-width:570px; }
    .rotation-import-dialog .import-dialog-form { padding:0; }
    .rotation-import-content { min-height:354px; padding:24px; }
    .rotation-import-dialog .import-dialog-form h3 { font-size:16px; line-height:24px; }
    .rotation-import-dialog .import-dialog-intro { margin-bottom:18px; color:var(--text); }
    .rotation-import-sources { display:flex; gap:4px; padding:4px; margin-bottom:20px;
      border:1px solid var(--border-light); border-radius:7px; background:var(--bg-panel-alt); }
    .rotation-import-source { display:flex; flex:1; align-items:center; justify-content:center; gap:8px;
      min-width:0; min-height:37px; padding:7px 8px; border:0; border-radius:3px;
      background:transparent; color:var(--text); font:inherit; font-size:12px; cursor:pointer; }
    .rotation-import-source[aria-selected="true"] { background:#34343c; color:var(--text-bright); font-weight:600; }
    .rotation-import-source:hover { background:#2b2b32; }
    .rotation-import-dialog :is(button, input, select):focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    .rotation-import-icon { width:16px; height:16px; flex-shrink:0; color:var(--text-dim); }
    .rotation-import-source[aria-selected="true"] .rotation-import-icon { color:inherit; }
    .rotation-import-dialog label { display:block; margin-bottom:9px; font-size:12px; font-weight:600;
      color:var(--text-bright); }
    .rotation-import-dialog :is(input, select) { width:100%; min-width:0; height:39px; padding:8px 10px;
      border:1px solid var(--border-light); border-radius:5px; background:var(--bg-panel-alt); color:var(--text); font-size:14px; }
    .rotation-import-help { margin:10px 0 0; color:var(--text); font-size:12px; line-height:1.5; }
    .rotation-import-experimental { display:flex; align-items:flex-start; gap:8px; margin:14px 0 0;
      color:var(--text); font-size:12px; line-height:1.5; }
    .rotation-import-experimental .rotation-import-icon { color:#e0bd68; margin-top:1px; }
    .rotation-import-dialog .import-dialog-drop { min-height:150px; padding:16px; border-width:1px; border-radius:5px; }
    .rotation-import-drop-icon { display:block; margin-bottom:10px; }
    .rotation-import-dialog .import-dialog-drop small { font-size:11px; color:var(--text); }
    .rotation-import-file-name { margin:10px 0 0; font-size:12px; overflow-wrap:anywhere; }
    .rotation-import-dialog .btn { min-height:34px; padding:7px 12px; font-size:12px; }
    .rotation-import-dialog .app-dialog-actions { align-items:center; gap:8px; margin:0; padding:15px 24px;
      border-top:1px solid var(--border-light); }
    .rotation-import-dialog .import-dialog-status { flex:1; min-width:0; margin:0; line-height:1.5; overflow-wrap:anywhere; }
    .rotation-import-dialog .import-dialog-apply { background:#34343c; border-color:#34343c;
      color:var(--text-bright); font-weight:600; }
    .rotation-import-dialog .import-dialog-apply:disabled { opacity:.55; }
    @media (max-width:480px) {
      .rotation-import-content { padding:20px 16px; }
      .rotation-import-source { gap:5px; padding-inline:4px; font-size:11px; }
      .rotation-import-dialog .app-dialog-actions { flex-wrap:wrap; padding:15px 16px; }
      .rotation-import-dialog .import-dialog-status { flex-basis:100%; }
    }
    .rotation-import-observations { display:grid; gap:6px; margin:10px 0 0; padding:0; list-style:none; font-size:11px; }
    .rotation-import-observations li { padding:9px 10px; border:1px solid var(--border);
      border-radius:5px; background:rgba(102,170,255,.06); line-height:1.45; }
    .rotation-import-observations strong { display:block; margin-bottom:2px; color:var(--text-bright); }
    .rotation-import-observation-summary { color:var(--text); }
    .rotation-import-observation-detail { display:block; margin-top:4px; color:var(--text-dim); }
  `;

/** Decorative source icons keep the tab labels readable without adding screen-reader noise. */
function sourceIcon(source: RotationImportSource | 'warning' | 'document'): string {
  const paths = {
    saved: '<path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
    file: '<path d="M12 16V3m-4 4 4-4 4 4M4 14v6h16v-6"/>',
    link: '<path d="m10 13 4-2m-6 4-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
    warning: '<path d="m12 3 10 18H2ZM12 9v5m0 3v1"/>',
    document: '<path d="M14 2H6v20h12V6Zm0 0v5h4M12 18v-7m-3 3 3-3 3 3"/>'
  };
  return `<svg class="rotation-import-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[source]}</svg>`;
}

/** Show one source at a time while keeping notices and the final action shared by both destinations. */
function createDialog(document: Document, destination: RotationImportDestination): RotationImportDialogElements {
  ensureImportDialogStyles(document);
  ensureDocumentStyles(document, 'rotation-import-styles', ROTATION_IMPORT_STYLES);
  const reference = destination === 'reference';
  const titleId = `rotation-import-title-${destination}`;
  const prefix = `rotation-import-${destination}`;
  const sources: readonly RotationImportSource[] = reference ? ['saved', 'file', 'link'] : ['file', 'link'];
  const labels = { saved: 'Saved rotation', file: 'Upload file', link: 'Paste link' };
  const dialog = document.createElement('dialog');
  dialog.className = 'rotation-import-dialog';
  dialog.dataset.rotationImportDestination = destination;
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.innerHTML = `<form class="import-dialog-form app-dialog-body" method="dialog">
    <div class="rotation-import-content">
    <h3 id="${titleId}">${reference ? 'Load reference rotation' : 'Load rotation'}</h3>
    <p class="import-dialog-intro">Choose where to load your ${reference ? 'reference' : 'rotation'} from.</p>
    <div class="rotation-import-sources" role="tablist" aria-label="Rotation source">
      ${sources.map((source) => `<button type="button" class="rotation-import-source" role="tab" id="${prefix}-${source}-tab" aria-controls="${prefix}-${source}-panel" aria-selected="${source === 'link'}" tabindex="${source === 'link' ? 0 : -1}" data-rotation-import-source="${source}">${sourceIcon(source)}${labels[source]}</button>`).join('')}
    </div>
    ${
      reference
        ? `<div role="tabpanel" id="${prefix}-saved-panel" aria-labelledby="${prefix}-saved-tab" data-rotation-import-panel="saved" hidden>
      <label for="${prefix}-preset">Compatible rotation</label>
      <select id="${prefix}-preset" aria-describedby="${prefix}-preset-help" data-rotation-import-preset></select>
      <p class="rotation-import-help" id="${prefix}-preset-help">Only compatible saved rotations appear here.</p>
    </div>`
        : ''
    }
    <div role="tabpanel" id="${prefix}-file-panel" aria-labelledby="${prefix}-file-tab" data-rotation-import-panel="file" hidden>
      ${importDropZoneHtml('rotation-import', `<span class="rotation-import-drop-icon">${sourceIcon('document')}</span>Drop a rotation or combat log`, '.json · .evtc · .evtc.zip · .zevtc')}
      <p class="rotation-import-file-name" data-rotation-import-file-name hidden></p>
    </div>
    <div role="tabpanel" id="${prefix}-link-panel" aria-labelledby="${prefix}-link-tab" data-rotation-import-panel="link">
      <label for="${prefix}-report">Combat log link</label>
      <input id="${prefix}-report" type="url" inputmode="url" placeholder="Paste a dps.report or gw2wingman link" aria-describedby="${prefix}-link-help ${prefix}-link-warning" data-rotation-import-report-input autofocus>
      <p class="rotation-import-help" id="${prefix}-link-help">Supported sources: dps.report and gw2wingman.</p>
      <p class="rotation-import-experimental" id="${prefix}-link-warning">${sourceIcon('warning')}<span><strong>Experimental import.</strong> These sources omit some combat-log data. Review reconstructed casts before using.</span></p>
    </div>
    <p class="import-dialog-error" role="alert" data-rotation-import-error hidden></p>
    <ul class="import-dialog-notices" aria-label="Import notices" data-rotation-import-warnings hidden></ul>
    <ul class="rotation-import-observations" aria-label="Combat log observations" data-rotation-import-observations hidden></ul>
    </div>
    <div class="app-dialog-actions">
      <p class="import-dialog-status" role="status" data-rotation-import-status></p>
      <button type="button" class="btn" data-dialog-close>Cancel</button>
      <button type="button" class="btn btn-io import-dialog-apply" data-rotation-import-apply disabled>Review import</button>
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
    presetSelect: dialog.querySelector<HTMLSelectElement>('[data-rotation-import-preset]'),
    sourceTabs: [...dialog.querySelectorAll<HTMLButtonElement>('[data-rotation-import-source]')],
    sourcePanels: [...dialog.querySelectorAll<HTMLElement>('[data-rotation-import-panel]')],
    fileName: requiredDialogPart(dialog, '[data-rotation-import-file-name]'),
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
): HTMLDialogElement {
  fileInput.accept = ROTATION_IMPORT_ACCEPT;
  button.setAttribute('aria-haspopup', 'dialog');
  button.title = 'Load a rotation JSON or reconstruct one from an EVTC/dps.report/gw2wingman log';

  const elements = createDialog(button.ownerDocument, destination);
  let manifestRotations: BuildTemplatePreset[] = [];
  let manifestGeneration = 0;
  let importing = false;
  let activePreview: RotationImportPreview | null = null;
  let activeSource: RotationImportSource = 'link';
  let selectedFile: File | null = null;

  /** The footer reviews external sources first and only applies a preview belonging to the selected source. */
  const updateAction = (): void => {
    elements.applyButton.textContent =
      activePreview || activeSource === 'saved'
        ? destination === 'reference'
          ? 'Use as reference'
          : 'Apply rotation'
        : 'Review import';
    elements.applyButton.disabled =
      importing ||
      !(
        activePreview ||
        (activeSource === 'file' && selectedFile) ||
        (activeSource === 'link' && elements.reportInput.value.trim())
      );
  };

  const clearNotices = (): void => {
    elements.error.hidden = true;
    elements.error.textContent = '';
    renderImportNotices(elements.warnings, []);
    renderObservations(elements.observations, []);
  };

  const resetMessages = (): void => {
    activePreview = null;
    elements.status.classList.remove('is-success');
    elements.status.textContent =
      activeSource === 'saved'
        ? 'Choose a rotation'
        : activeSource === 'file'
          ? selectedFile
            ? 'File ready to review'
            : 'Choose a file to continue'
          : elements.reportInput.value.trim()
            ? 'Link ready to review'
            : 'Paste a link to continue';
    clearNotices();
    updateAction();
  };

  /** Switching sources discards the prior preview so the footer cannot apply a hidden selection. */
  const selectSource = (source: RotationImportSource): void => {
    activeSource = source;
    for (const tab of elements.sourceTabs) {
      const selected = tab.dataset.rotationImportSource === source;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }

    for (const panel of elements.sourcePanels) panel.hidden = panel.dataset.rotationImportPanel !== source;

    if (elements.presetSelect) elements.presetSelect.value = '';

    resetMessages();
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
      elements.reportInput.disabled = value;
      for (const tab of elements.sourceTabs) tab.disabled = value;

      if (elements.presetSelect) elements.presetSelect.disabled = value || !manifestRotations.length;

      elements.closeButton.disabled = value;
      updateAction();
    },
    settled() {
      fileInput.value = '';
    }
  });

  const populateManifestRotations = async (): Promise<void> => {
    const { presetSelect } = elements;

    if (!presetSelect) return;

    const request = ++manifestGeneration;
    presetSelect.disabled = true;
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
      .filter((entry) => manifestRotationMatchesBuild(entry.build, app.build, app.activeCatalog))
      .map((entry) => entry.preset);
    placeholder.textContent = manifestRotations.length ? 'Choose a rotation...' : 'No compatible rotations';
    manifestRotations.forEach((preset, index) => {
      const option = button.ownerDocument.createElement('option');
      option.value = String(index);
      option.textContent = preset.section ? `${preset.section} · ${preset.label}` : preset.label;
      presetSelect.append(option);
    });
    presetSelect.disabled = importing || !manifestRotations.length;
  };

  const selectFile = (file: File): void => {
    if (importing) return;

    selectedFile = file;
    elements.fileName.textContent = file.name;
    elements.fileName.hidden = false;
    selectSource('file');
    // Clear the native input so selecting the same file again still dispatches change.
    fileInput.value = '';
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
    selectedFile = null;
    elements.fileName.textContent = '';
    elements.fileName.hidden = true;
    elements.reportInput.value = '';
    // Comparisons start with compatible saved rotations; ordinary imports start ready for a dps.report link.
    selectSource(destination === 'reference' ? 'saved' : 'link');
    showDialog(elements.dialog);
    void populateManifestRotations();
  });
  bindImportFileSources(elements.dropZone, elements.browseButton, fileInput, selectFile);
  for (const tab of elements.sourceTabs) {
    tab.addEventListener('click', () => {
      const source = tab.dataset.rotationImportSource as RotationImportSource;

      if (source !== activeSource) selectSource(source);
    });
    // Roving tab focus follows native horizontal tablist navigation without entering hidden panels.
    tab.addEventListener('keydown', (event) => {
      const index = elements.sourceTabs.indexOf(tab);
      const next =
        event.key === 'ArrowRight'
          ? (index + 1) % elements.sourceTabs.length
          : event.key === 'ArrowLeft'
            ? (index + elements.sourceTabs.length - 1) % elements.sourceTabs.length
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? elements.sourceTabs.length - 1
                : null;

      if (next === null) return;

      event.preventDefault();
      const nextTab = elements.sourceTabs[next]!;
      nextTab.click();
      nextTab.focus();
    });
  }

  elements.reportInput.addEventListener('input', resetMessages);
  elements.reportInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();
    void selectReport();
  });
  elements.presetSelect?.addEventListener('change', () => {
    resetMessages();
    void selectPreset();
  });
  elements.applyButton.addEventListener('click', () => {
    if (importing) return;

    if (!activePreview) {
      if (activeSource === 'link') void selectReport();
      else if (activeSource === 'file' && selectedFile) {
        const file = selectedFile;
        void importer.load(
          () => previewRotationFile(file, app),
          `Reading ${file.name}…`,
          `Could not import ${file.name}.`
        );
      }

      return;
    }

    try {
      importer.validateDestination();
    } catch (error) {
      resetMessages();
      elements.error.hidden = false;
      elements.error.textContent = errorMessage(error);
      return;
    }

    if (destination === 'reference') {
      // References share the workspace simulation settings with Current and every other build tab.
      if (applyTransitionDelays(app, activePreview.transitionDelays ?? null)) app.changed();

      app.loadRotationReference(activePreview.rotation);

      // Keep display context beside the imported reference without changing the simulation API.
      if (app.rotationComparison)
        app.rotationComparison.reference = activePreview.reference ?? {
          label: activePreview.description,
          warnings: activePreview.warnings
        };
    } else applyRotationImportPreview(app, activePreview);

    activePreview = null;
    elements.dialog.close();
  });
  elements.dialog.addEventListener('close', () => {
    activePreview = null;
    importer.cancel();
  });
  return elements.dialog;
}
