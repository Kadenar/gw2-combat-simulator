import { fetchJsonAsset, getRotationItems } from '#gw2/app/import-export/files.js';
import { loadPresetBundle } from '#gw2/app/build/library/assets.js';
import { replaceBuild, replaceBuildConfiguration, replaceBuildRotation } from '#gw2/app/build/state/persistence.js';
import { addBuildTab, captureBuildDestination, saveBuildWorkspace } from '#gw2/app/build/state/workspace.js';
import { renderBuildTabs } from '#gw2/app/build/panels/workspace-tabs.js';
import { renderTimeline } from '#gw2/app/rotation/timeline/view.js';
import { buildSignature, templateTileContent } from '#gw2/app/build/library/model.js';
import { updateTemplateSelection } from '#gw2/app/build/library/view.js';
import type { MyBuild } from '#gw2/app/build/library/storage.js';
import type { BuildTemplatePreset } from '#gw2/app/build/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';

type TemplateLoadAction = 'build' | 'rotation' | 'template' | 'new-tab';

/** Loads a saved snapshot into the intended open tab, retaining the same reset and Undo behavior as templates. */
export function loadMyBuildEntry(app: ProfessionAppState, entry: MyBuild): void {
  const container = app.templateContainer;
  const newBuild = container?.dataset.newBuild === 'true';
  container?.querySelector<HTMLDialogElement>('.build-templates-dialog')?.close();
  if (newBuild) {
    delete container.dataset.newBuild;
    addBuildTab(app, entry.build, entry.name, app.patchId, entry.build);
    saveBuildWorkspace(app);
    renderBuildTabs(app);
    return;
  }

  const previousBuild = structuredClone(app.build);
  const tab = app.workspace?.tabs.find(({ id }) => id === app.workspace?.activeTabId);
  if (tab) tab.templateUndoResetBuild = tab.templateBuild;
  // Library entries were converted when loaded or saved; copy so edits cannot change the snapshot.
  app.build = structuredClone(entry.build);
  app.currentTemplate = null;
  app.changed(true, true, { deferRotationRender: true });
  if (tab) {
    tab.templateBuild = structuredClone(app.build);
    tab.name = entry.name;
  }

  showTemplateUndo(app, `Loaded ${entry.name}.`, previousBuild);
  saveBuildWorkspace(app);
  renderBuildTabs(app);
}

function actionLabel(action: TemplateLoadAction): string {
  if (action === 'build') return 'build';
  if (action === 'rotation') return 'rotation';
  return 'template';
}

function loadedMessage(preset: BuildTemplatePreset, action: TemplateLoadAction): string {
  const name = preset.section ? `${preset.section} ${preset.label}` : preset.label;
  if (action === 'build') return `Loaded the ${name} build only.`;
  if (action === 'rotation') return `Loaded the ${name} rotation only.`;
  return `Loaded the ${name} template.`;
}

function showTemplateUndo(app: ProfessionAppState, message: string, previousBuild: Gw2CanonicalBuild): void {
  app.templateUndoBuild = previousBuild;
  app.templateUndoMessage = message;
  const toast = app.templateContainer?.querySelector<HTMLElement>('.template-toast');
  if (!toast) return;
  toast.hidden = false;
  const messageElement = toast.querySelector('.template-toast-message');
  if (messageElement) messageElement.textContent = message;
}

/** Applies a validated preset to its intended tab, retaining progress, reset, and undo state across async loading. */
export async function loadTemplateAction(
  app: ProfessionAppState,
  preset: BuildTemplatePreset,
  action: TemplateLoadAction,
  button: HTMLButtonElement
): Promise<void> {
  const container = app.templateContainer;
  const loading = container?.querySelector<HTMLElement>('.template-load-status');
  if (loading && !loading.hidden) return;
  const previousBuild = structuredClone(app.build);
  const validateDestination = captureBuildDestination(app);
  const patchId = app.patchId;
  const buttons = container?.querySelectorAll<HTMLButtonElement>('button[data-template-index]') || [button];
  // A selection dismisses the picker immediately; progress stays in the editor while assets load.
  for (const control of buttons) control.disabled = true;
  if (loading) {
    loading.textContent = `Loading ${[preset.section, preset.label].filter(Boolean).join(' · ')}…`;
    loading.hidden = false;
  }

  container?.querySelector<HTMLDialogElement>('.build-templates-dialog')?.close();
  const focusTarget = typeof document === 'undefined' ? null : document.activeElement;
  // Keep the old rotation out of view through both asset loading and the template's first simulation.
  const rotationLoading = { revision: app.buildRevision, fetching: true };
  app.templateRotationLoading = rotationLoading;
  if (container) renderTimeline(app);
  try {
    const name = [preset.section, preset.label, templateTileContent(preset).weapons].filter(Boolean).join(' · ');
    if (action === 'rotation') {
      if (!preset.rotation) {
        throw new Error('Rotation asset missing.');
      }

      const rotationData = await fetchJsonAsset(preset.rotation);
      const rotationItems = getRotationItems(rotationData);
      if (!Array.isArray(rotationItems)) {
        throw new Error('Rotation array missing.');
      }

      validateDestination();
      app.build = replaceBuildRotation(rotationItems, app.build, app.adapter);
      app.currentTemplate = null;
      app.changed(false, false, { deferRotationRender: true });
    } else if (action === 'build') {
      const buildData = await fetchJsonAsset(preset.build);
      validateDestination();
      // The codec rejects a build saved for another profession.
      app.build = replaceBuildConfiguration(buildData, app.build, app.adapter);
      app.currentTemplate = null;
      app.changed(true, true, { deferRotationRender: true });
    } else {
      const { buildData, rotationItems } = await loadPresetBundle(preset);
      if (preset.rotation && !Array.isArray(rotationItems)) {
        throw new Error('Rotation array missing.');
      }

      // Validate the complete bundle before creating a tab or replacing the destination build. One codec pass
      // rejects another profession's build, migrates it, and resolves the rotation against its own specializations.
      const template = buildData && typeof buildData === 'object' && !Array.isArray(buildData) ? buildData : {};
      const replacement = replaceBuild({ ...template, rotation: rotationItems ?? [] }, app.adapter);
      if (action === 'new-tab') {
        addBuildTab(app, replacement, name, patchId);
      } else {
        validateDestination();
        app.build = replacement;
        app.changed(true, true, { deferRotationRender: true });
      }

      app.currentTemplate = {
        build: preset.build,
        signature: buildSignature(app.build)
      };
      updateTemplateSelection(app);
    }

    rotationLoading.revision = app.buildRevision;
    rotationLoading.fetching = false;
    app.templateRotationLoading = rotationLoading;
    if (container) renderTimeline(app);

    // Keep the previous reset target with this tab's undo state, including rotation-only loads.
    const tab = app.workspace?.tabs.find(({ id }) => id === app.workspace?.activeTabId);
    if (tab && action !== 'new-tab') tab.templateUndoResetBuild = tab.templateBuild;
    // Remember successful build loads for this tab's reset; rotation-only loads keep its existing baseline.
    if (tab && action !== 'rotation') {
      tab.templateBuild = structuredClone(app.build);
      tab.name = name.trim().slice(0, 80) || 'New build';
    }

    if (action !== 'new-tab') showTemplateUndo(app, loadedMessage(preset, action), previousBuild);
    saveBuildWorkspace(app);
    renderBuildTabs(app);
  } catch (error) {
    if (app.templateRotationLoading === rotationLoading) {
      delete app.templateRotationLoading;
      if (container) renderTimeline(app);
    }

    const message = error instanceof Error ? error.message : String(error);
    alert(`Failed to load ${actionLabel(action)}: ${message}`);
  } finally {
    for (const control of buttons) control.disabled = false;
    if (loading) loading.hidden = true;
    // Loading can replace the tab trigger that received focus when the picker closed.
    if (focusTarget && !focusTarget.isConnected && document.activeElement === document.body) {
      document
        .querySelector<HTMLButtonElement>('.build-tab.is-active .build-tab-menu-trigger')
        ?.focus({ preventScroll: true });
    }
  }
}

/** Restores the active tab's previous build and reset baseline after a library replacement. */
export function undoTemplateLoad(app: ProfessionAppState): void {
  if (!app.templateUndoBuild) return;
  // Restore the reset target before changed() persists the undone build.
  const tab = app.workspace?.tabs.find(({ id }) => id === app.workspace?.activeTabId);
  if (tab) {
    tab.templateBuild = tab.templateUndoResetBuild;
    delete tab.templateUndoResetBuild;
  }

  app.build = app.templateUndoBuild;
  app.templateUndoBuild = null;
  app.currentTemplate = null;
  app.changed(true, true, { deferRotationRender: true });
  const toast = app.templateContainer?.querySelector<HTMLElement>('.template-toast');
  if (toast) toast.hidden = true;
}
