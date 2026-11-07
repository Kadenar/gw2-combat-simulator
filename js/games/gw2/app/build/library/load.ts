/** Loads library data into a fixed destination and installs its complete editing state before notifying the app. */
import { loadPresetBundle } from '#gw2/app/build/library/assets.js';
import { buildSignature } from '#gw2/app/build/library/model.js';
import type { LibraryLoadRequest, TemplateLoadAction } from '#gw2/app/build/library/state.js';
import { replaceBuild, replaceBuildConfiguration, replaceBuildRotation } from '#gw2/app/build/state/persistence.js';
import { normalizeSelectedSkills } from '#gw2/app/build/state/skill-selection.js';
import { createBuildTab } from '#gw2/app/build/state/workspace.js';
import type { BuildTemplatePreset, BuildTemplateSelection } from '#gw2/app/build/types.js';
import { commitBuildReplacement } from '#gw2/app/rotation/editing/commit.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { fetchJsonAsset, getRotationItems } from '#gw2/integrations/assets.js';
import { normalizeInfusions } from '#gw2/platform/builds/codec.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';

/** Starting another selection supersedes the previous request without waiting for its download. */
export function beginLibraryLoad(app: ProfessionAppState, action: TemplateLoadAction): LibraryLoadRequest {
  const request = {
    action: app.workspace?.scenario ? ('build' as const) : action,
    workspace: app.workspace,
    tabId: app.workspace?.activeTabId,
    patchId: app.patch.id,
    revision: app.analysis.state.buildRevision
  };
  app.libraryLoad = request;
  return request;
}

/** Rejects changed workspaces, tabs, or patches; in-place loads also require an unchanged build. */
function validateDestination(app: ProfessionAppState, request: LibraryLoadRequest): void {
  if (
    app.workspace !== request.workspace ||
    app.workspace?.activeTabId !== request.tabId ||
    app.patch.id !== request.patchId ||
    (request.action !== 'new-tab' && app.analysis.state.buildRevision !== request.revision)
  ) {
    throw new Error('The build changed while loading. Load it again in the intended tab.');
  }
}

function installLibraryBuild(
  app: ProfessionAppState,
  replacement: Gw2CanonicalBuild,
  {
    name,
    message,
    action,
    selection
  }: {
    name: string;
    message: string;
    action: TemplateLoadAction;
    selection: string | null;
  }
): void {
  // Apply the selected patch's slot rules before capturing the reset target or selection signature.
  replacement.infusions = normalizeInfusions(replacement.infusions, []);
  normalizeSelectedSkills({
    build: replacement,
    activeCatalog: app.patch.catalog,
    profession: app.profession,
    adapter: app.adapter,
    analysis: action === 'new-tab' ? { state: { results: null } } : app.analysis
  });
  const currentTemplate: BuildTemplateSelection | null = selection
    ? { build: selection, signature: buildSignature(replacement) }
    : null;

  if (action === 'new-tab') {
    if (!app.workspace || !app.activateBuildTab) return;

    const tab = createBuildTab(replacement, name, app.patch.id);
    tab.templateBuild = structuredClone(replacement);
    tab.session.currentTemplate = currentTemplate;
    app.workspace.tabs.push(tab);
    app.activateBuildTab(tab.id);
    return;
  }

  const tab = app.workspace?.tabs.find(({ id }) => id === app.workspace?.activeTabId);
  app.templateUndo = {
    build: structuredClone(app.build),
    name: tab?.name,
    resetBuild: tab?.templateBuild,
    selection: app.currentTemplate,
    message
  };
  app.currentTemplate = currentTemplate;

  if (tab && action !== 'rotation') {
    tab.templateBuild = structuredClone(replacement);
    tab.name = name.trim().slice(0, 80) || 'New build';
  }

  commitBuildReplacement(app, replacement, {
    rebuildStatic: action !== 'rotation',
    options: action === 'rotation' ? undefined : { deferRotationRender: true }
  });
}

/** Downloads and validates the complete input before replacing anything; obsolete requests have no effect. */
export async function loadLibraryTemplate(
  app: ProfessionAppState,
  request: LibraryLoadRequest,
  preset: BuildTemplatePreset
): Promise<boolean> {
  try {
    const action = request.action;
    let replacement: Gw2CanonicalBuild;

    if (action === 'rotation') {
      if (!preset.rotation) throw new Error('Rotation asset missing.');

      const rotation = getRotationItems(await fetchJsonAsset(preset.rotation));

      if (app.libraryLoad !== request) return false;

      validateDestination(app, request);

      if (!Array.isArray(rotation)) throw new Error('Rotation array missing.');

      replacement = replaceBuildRotation(rotation, app.build, app.adapter);
    } else if (action === 'build') {
      const data = await fetchJsonAsset(preset.build);

      if (app.libraryLoad !== request) return false;

      validateDestination(app, request);
      replacement = replaceBuildConfiguration(data, app.build, app.adapter);

      // Boss templates supply configuration only; their rotations belong to the encounter draft.
      if (app.workspace?.scenario) replacement.rotation = [];
    } else {
      const { buildData, rotationItems } = await loadPresetBundle(preset);

      if (app.libraryLoad !== request) return false;

      validateDestination(app, request);

      if (preset.rotation && !Array.isArray(rotationItems)) throw new Error('Rotation array missing.');

      const template = buildData && typeof buildData === 'object' && !Array.isArray(buildData) ? buildData : {};
      replacement = replaceBuild({ ...template, rotation: rotationItems ?? [] }, app.adapter);
    }

    const label = preset.section ? `${preset.section} ${preset.label}` : preset.label;
    const loaded = action === 'build' ? 'build only' : action === 'rotation' ? 'rotation only' : 'template';
    installLibraryBuild(app, replacement, {
      name: [preset.section, preset.label].filter(Boolean).join(' · '),
      message: `Loaded the ${label} ${loaded}.`,
      action,
      selection: action === 'template' || action === 'new-tab' ? preset.build : null
    });
    return true;
  } catch (error) {
    if (app.libraryLoad !== request) return false;

    throw error;
  }
}

/** Loading a saved build replaces the whole build and supersedes any pending download. */
export function loadLibraryBuild(
  app: ProfessionAppState,
  build: Gw2CanonicalBuild,
  name: string,
  newTab: boolean
): void {
  delete app.libraryLoad;
  installLibraryBuild(app, structuredClone(build), {
    name,
    message: `Loaded ${name}.`,
    action: newTab ? 'new-tab' : 'template',
    selection: null
  });
}

/** Undo restores the previous build and its library metadata before persistence or simulation sees it. */
export function undoLibraryLoad(app: ProfessionAppState): void {
  const undo = app.templateUndo;

  if (!undo) return;

  const tab = app.workspace?.tabs.find(({ id }) => id === app.workspace?.activeTabId);

  if (tab) {
    tab.templateBuild = undo.resetBuild;
    tab.name = undo.name!;
  }

  app.currentTemplate = undo.selection;
  app.templateUndo = null;
  commitBuildReplacement(app, undo.build, { options: { deferRotationRender: true } });
}
