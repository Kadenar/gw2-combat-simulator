import { escapeHtml as esc } from '#ui/shared/html.js';
import { bindDialog, showDialog } from '#browser/page/dialog.js';
import { fetchJsonAsset } from '#gw2/app/import-export/files.js';
import { deleteMyBuild, loadMyBuilds, myBuildsStorageKey, saveMyBuild } from '#gw2/app/build/library/storage.js';
import { loadMyBuildEntry, loadTemplateAction, undoTemplateLoad } from '#gw2/app/build/library/actions.js';
import {
  templateSpecializations,
  isTemplateFilter,
  isTemplateBoonFilter,
  type TemplateFilter,
  type TemplateBoonFilter
} from '#gw2/app/build/library/model.js';
import {
  createBuildLibraryView,
  renderMyBuilds,
  applyTemplateFilter,
  showBuildLibraryView,
  closeTemplateMenus,
  updateTemplateSelection
} from '#gw2/app/build/library/view.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { BuildTemplateSection } from '#gw2/app/build/types.js';

/** Connects catalog loading and library interactions to their view, storage, and build actions. */
export async function initBuildTemplates(app: ProfessionAppState): Promise<void> {
  let manifest: readonly BuildTemplateSection[] = [];
  try {
    // Bundled catalogs use named sections; a missing optional asset leaves the personal library available.
    manifest =
      ((await fetchJsonAsset(`data/gw2/builds/${app.adapter.id}/manifest.json`, { optional: true })) as
        BuildTemplateSection[] | null) ?? [];
  } catch (error) {
    // The user's local library remains available even when the standard catalog cannot be fetched.
    console.error(`Failed to load build templates for ${app.adapter.id}:`, error);
  }

  try {
    const specializations = templateSpecializations(manifest);
    let myBuilds = loadMyBuilds(app.adapter);

    const { container, dialog, saveDialog } = createBuildLibraryView(app, manifest, specializations);
    renderMyBuilds(container, myBuilds);
    {
      let saveTrigger: HTMLElement | null = null;
      const target = saveDialog.querySelector<HTMLSelectElement>('select')!;
      const name = saveDialog.querySelector<HTMLInputElement>('#build-save-name')!;
      const category = saveDialog.querySelector<HTMLInputElement>('#build-save-category')!;
      const save = saveDialog.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      target.addEventListener('change', () => {
        const selected = target.selectedOptions[0];
        const existingName = selected?.dataset.name;
        if (existingName) name.value = existingName;
        category.value = selected?.dataset.category || '';
        save.disabled = !name.value.trim();
      });
      name.addEventListener('input', () => {
        save.disabled = !name.value.trim();
      });
      saveDialog.querySelector('form')!.addEventListener('submit', (event) => {
        event.preventDefault();
        try {
          myBuilds = saveMyBuild(app, name.value, target.value || undefined, category.value);
          const search = container
            .querySelector<HTMLInputElement>('.build-library-search input')!
            .value.trim()
            .toLowerCase();
          renderMyBuilds(container, myBuilds, search);
          saveDialog.close();
        } catch (error) {
          alert(`Failed to save build: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
      bindDialog(dialog);
      bindDialog(saveDialog);
      saveDialog.addEventListener('close', () => saveTrigger?.focus({ preventScroll: true }));
      container.addEventListener('open-build-save', (event) => {
        saveTrigger = (event as CustomEvent<HTMLElement>).detail || null;
        // Offer overwrite targets from the stored library, including builds saved in other browser tabs.
        myBuilds = loadMyBuilds(app.adapter);
        target.innerHTML = `<option value="">New build</option>${myBuilds
          .map(
            ({ id, name, category }) =>
              `<option value="${esc(id)}" data-name="${esc(name)}" data-category="${esc(category || '')}">Overwrite ${esc(name)}</option>`
          )
          .join('')}`;
        name.value = app.workspace?.tabs.find(({ id }) => id === app.workspace?.activeTabId)?.name || 'New build';
        category.value = '';
        target.value = '';
        save.disabled = !name.value.trim();
        showDialog(saveDialog);
        name.focus();
        name.select();
      });
      dialog.addEventListener('close', () => {
        closeTemplateMenus(container);
        delete container.dataset.newBuild;
      });
    }

    let templateFilter: TemplateFilter = 'all';
    let boonFilter: TemplateBoonFilter = 'all';
    let specializationFilter: string | null = null;
    let search = '';
    container.querySelector<HTMLElement>('.build-library-tabs')!.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const tabs = [...container.querySelectorAll<HTMLButtonElement>('[data-library-view]')];
      const current = tabs.indexOf(event.target as HTMLButtonElement);
      const next = tabs[(current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      next.focus();
      next.click();
    });
    container.querySelector<HTMLInputElement>('.build-library-search input')!.addEventListener('input', (event) => {
      search = (event.currentTarget as HTMLInputElement).value.trim().toLowerCase();
      applyTemplateFilter(container, templateFilter, boonFilter, specializationFilter, search);
      renderMyBuilds(container, myBuilds, search);
    });
    container.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const viewButton = target.closest<HTMLButtonElement>('[data-library-view]');
      if (viewButton) {
        showBuildLibraryView(container, viewButton.dataset.libraryView === 'mine' ? 'mine' : 'templates');
        return;
      }

      const libraryButton = target.closest<HTMLButtonElement>('[data-library-action]');
      if (libraryButton) {
        const action = libraryButton.dataset.libraryAction;
        const id = libraryButton.dataset.myBuildId;
        const entry = myBuilds.find((build) => build.id === id);
        if (!entry) return;
        closeTemplateMenus(container);
        if (action === 'load') loadMyBuildEntry(app, entry);
        if (action === 'delete' && confirm(`Delete ${entry.name}? This cannot be undone.`)) {
          try {
            myBuilds = deleteMyBuild(app, entry.id);
            renderMyBuilds(container, myBuilds, search);
          } catch (error) {
            alert(`Failed to delete build: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        return;
      }

      const filterButton = target.closest('[data-template-filter]');
      if (filterButton instanceof HTMLButtonElement) {
        const filter = filterButton.dataset.templateFilter;
        if (isTemplateFilter(filter)) {
          templateFilter = filter;
          filterButton.closest('details')?.removeAttribute('open');
          applyTemplateFilter(container, templateFilter, boonFilter, specializationFilter, search);
        }

        return;
      }

      const boonFilterButton = target.closest('[data-template-boon-filter]');
      if (boonFilterButton instanceof HTMLButtonElement) {
        const boon = boonFilterButton.dataset.templateBoonFilter;
        if (isTemplateBoonFilter(boon)) {
          boonFilter = boon;
          boonFilterButton.closest('details')?.removeAttribute('open');
          applyTemplateFilter(container, templateFilter, boonFilter, specializationFilter, search);
        }

        return;
      }

      const specializationFilterButton = target.closest('[data-template-specialization-filter]');
      if (specializationFilterButton instanceof HTMLButtonElement) {
        const specialization = specializationFilterButton.dataset.templateSpecializationFilter || null;
        if (specialization === null || specializations.includes(specialization)) {
          specializationFilter = specialization;
          specializationFilterButton.closest('details')?.removeAttribute('open');
          applyTemplateFilter(container, templateFilter, boonFilter, specializationFilter, search);
        }

        return;
      }

      const button = target.closest('[data-template-action]');
      if (!(button instanceof HTMLButtonElement)) return;
      const action = button.dataset.templateAction;
      if (action === 'undo') {
        undoTemplateLoad(app);
        return;
      }

      if (action !== 'build' && action !== 'rotation' && action !== 'template' && action !== 'new-tab') {
        return;
      }

      const preset = app.templatePresets[Number(button.dataset.templateIndex)];
      if (!preset) return;
      closeTemplateMenus(container);
      // Browsing from New creates an independent build; explicit partial-load actions still target the current build.
      const destination = action === 'template' && container.dataset.newBuild === 'true' ? 'new-tab' : action;
      delete container.dataset.newBuild;
      loadTemplateAction(app, preset, destination, button);
    });
    window.addEventListener('storage', (event) => {
      // Another browser tab changed the library; show its snapshots instead of a stale list.
      if (event.key !== null && event.key !== myBuildsStorageKey(app.adapter)) return;
      myBuilds = loadMyBuilds(app.adapter);
      renderMyBuilds(container, myBuilds, search);
    });
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof Element && !target.closest('.template-actions, .template-filter')) {
        closeTemplateMenus(container);
      }
    });
    updateTemplateSelection(app);
  } catch (error) {
    console.error(`Failed to build the template picker for ${app.adapter.id}:`, error);
  }
}
