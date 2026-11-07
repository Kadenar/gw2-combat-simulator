/** Shows library loading progress. The load module checks destinations, replaces builds, and handles Undo. */
import {
  beginLibraryLoad,
  loadLibraryBuild,
  loadLibraryTemplate,
  undoLibraryLoad
} from '#gw2/app/build/library/load.js';
import type { TemplateLoadAction } from '#gw2/app/build/library/state.js';
import type { MyBuild } from '#gw2/app/build/library/storage.js';
import { setLibraryNavigationLoading, updateTemplateSelection } from '#gw2/app/build/library/view.js';
import type { BuildTemplatePreset } from '#gw2/app/build/types.js';
import { renderTimeline } from '#gw2/app/rotation/timeline/view.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

/** A local selection replaces any pending download and clears its progress immediately. */
export function loadMyBuildEntry(app: ProfessionAppState, entry: MyBuild): void {
  const container = app.templateContainer;
  const newTab = container?.dataset.newBuild === 'true';

  if (container) delete container.dataset.newBuild;

  container?.querySelector<HTMLDialogElement>('.build-templates-dialog')?.close();
  // changed() and tab activation redraw the timeline. Keep the loading placeholder until the replacement
  // build has its first result, as with template loads.
  delete app.templateRotationLoading;
  try {
    loadLibraryBuild(app, entry.build, entry.name, newTab);
    updateTemplateSelection(app);
  } finally {
    finishLoading(app);
  }
}

/** Hides loading progress and enables destination controls when loading ends. */
function finishLoading(app: ProfessionAppState): void {
  const loading = app.templateContainer?.querySelector<HTMLElement>('.template-load-status');

  if (loading) loading.hidden = true;

  setLibraryNavigationLoading(app, false);
}

/** Only the latest request may repaint progress, report an error, or release the destination controls. */
export async function loadTemplateAction(
  app: ProfessionAppState,
  preset: BuildTemplatePreset,
  action: TemplateLoadAction
): Promise<void> {
  const request = beginLibraryLoad(app, action);
  const container = app.templateContainer;
  const loading = container?.querySelector<HTMLElement>('.template-load-status');

  if (loading) {
    loading.textContent = `Loading ${[preset.section, preset.label].filter(Boolean).join(' · ')}…`;
    loading.hidden = false;
  }

  container?.querySelector<HTMLDialogElement>('.build-templates-dialog')?.close();
  setLibraryNavigationLoading(app, true);
  const rotationLoading = { revision: app.analysis.state.buildRevision, fetching: true };
  app.templateRotationLoading = rotationLoading;

  if (container) renderTimeline(app);

  try {
    if (!(await loadLibraryTemplate(app, request, preset))) return;

    rotationLoading.revision = app.analysis.state.buildRevision;
    rotationLoading.fetching = false;
    app.templateRotationLoading = rotationLoading;
    updateTemplateSelection(app);

    if (container) renderTimeline(app);
  } catch (error) {
    if (app.libraryLoad !== request) return;

    if (app.templateRotationLoading === rotationLoading) delete app.templateRotationLoading;

    if (container) renderTimeline(app);

    const label = request.action === 'build' || request.action === 'rotation' ? request.action : 'template';
    alert(`Failed to load ${label}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (app.libraryLoad === request) {
      delete app.libraryLoad;
      finishLoading(app);
    }
  }
}

/** Restores the build, tab name, reset target, and selection captured before the last library replacement. */
export function undoTemplateLoad(app: ProfessionAppState): void {
  // Undo supersedes a pending download so its late arrival cannot report a destination error.
  delete app.libraryLoad;
  delete app.templateRotationLoading;
  undoLibraryLoad(app);
  updateTemplateSelection(app);
  finishLoading(app);
}
