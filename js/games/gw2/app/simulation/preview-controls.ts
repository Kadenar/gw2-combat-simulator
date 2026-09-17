/** Exposes the historical Guardian preview without adding engine settings to persisted builds. */
import { GUARDIAN_PREVIEW_CONTENT_REVISION } from '#gw2/professions/guardian/combat-engine/compile.js';
import { fetchJsonAsset, getRotationItems } from '#gw2/app/build/io/files.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

export const guardianPreviewSelection = () => ({
  engine: 'preview' as const,
  contentRevision: GUARDIAN_PREVIEW_CONTENT_REVISION,
  patchId: 'reference' as const,
  seed: 1
});

export function mountPreviewControls(app: ProfessionAppState): void {
  if (app.contentId !== 'guardian') return;
  const palette = document.getElementById('rotation-palette');
  if (!palette || document.getElementById('combat-engine-controls')) return;
  const controls = document.createElement('section');
  controls.id = 'combat-engine-controls';
  controls.className = 'perma-group';
  controls.setAttribute('aria-label', 'Simulation engine');
  controls.innerHTML = `<label>Simulation engine <select id="combat-engine-select"><option value="legacy">Legacy</option><option value="preview">New engine preview — historical Willbender</option></select></label>
    <button type="button" class="btn" id="combat-preview-load" hidden>Load Willbender reference</button>
    <p id="combat-preview-scope" hidden>Historical condition Willbender: pistol/torch and pistol/pistol. Gear and rotation edits are supported; other builds may be rejected. Patch changes, transition delays, conditional attribute previews, RNG, modifier/relic comparisons, rotation comparison, and the optimizer are unavailable. Select Legacy to restore them.</p>
    <p id="combat-engine-status" role="status" aria-live="polite"></p>`;
  palette.before(controls);
  const select = controls.querySelector<HTMLSelectElement>('select')!;
  const button = controls.querySelector<HTMLButtonElement>('button')!;
  let loading = 0;
  select.addEventListener('change', () => {
    loading++;
    button.disabled = false;
    app.selectSimulationEngine?.(select.value === 'preview' ? 'preview' : 'legacy');
  });
  button.addEventListener('click', async () => {
    const generation = ++loading;
    const revision = app.buildRevision;
    const tab = app.workspace?.activeTabId;
    const selection = app.previewSelection;
    button.disabled = true;
    const status = controls.querySelector('#combat-engine-status')!;
    status.textContent = 'Loading Willbender reference…';
    try {
      const [build, rotation] = await Promise.all([
        fetchJsonAsset('data/gw2/builds/guardian/b-condi-willbender-pistol-torch.json'),
        fetchJsonAsset('data/gw2/rotations/guardian/r-condi-willbender-pistol-torch-bench.json')
      ]);
      // Asset loading cannot overwrite a newer edit, tab, or engine choice.
      if (
        generation !== loading ||
        revision !== app.buildRevision ||
        tab !== app.workspace?.activeTabId ||
        selection !== app.previewSelection
      )
        return;
      const commands = getRotationItems(rotation);
      if (!commands) throw new Error('The reference rotation could not be loaded.');
      app.build = app.adapter.toApplicationBuild({ ...(build as object), rotation: commands });
      const activeTab = app.workspace?.tabs.find(({ id }) => id === tab);
      if (activeTab) activeTab.templateBuild = structuredClone(app.build);
      app.rotationInsertionIndex = 0;
      app.changed();
    } catch (error) {
      if (generation === loading && selection === app.previewSelection && tab === app.workspace?.activeTabId)
        status.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      if (generation === loading) button.disabled = false;
    }
  });
  renderPreviewControls(app);
}

/** Reflect the selected engine and its current result; errors never leave the old score labeled current. */
export function renderPreviewControls(app: ProfessionAppState): void {
  if (app.contentId !== 'guardian' || typeof document === 'undefined') return;
  const select = document.getElementById('combat-engine-select') as HTMLSelectElement | null;
  if (!select) return;
  const preview = Boolean(app.previewSelection);
  select.value = preview ? 'preview' : 'legacy';
  document.getElementById('combat-preview-load')!.hidden = !preview;
  document.getElementById('combat-preview-scope')!.hidden = !preview;
  const status = document.getElementById('combat-engine-status')!;
  status.textContent =
    app.simulationError ||
    (preview
      ? app.simulationStatus === 'idle'
        ? 'New engine preview result · historical Willbender reference'
        : 'Calculating new engine preview…'
      : '');
  for (const control of document.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
    '.patch-preview-picker button, #simulation-transition-delays input'
  )) {
    control.disabled = preview;
    control.title = preview ? 'Unavailable in the historical engine preview.' : '';
  }
}
