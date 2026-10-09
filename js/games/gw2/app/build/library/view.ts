import { escapeHtml as esc } from '#ui/shared/html.js';
import type { BuildTemplatePreset, BuildTemplateSection } from '#gw2/app/build/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { MyBuild } from '#gw2/app/build/library/storage.js';
import {
  buildSignature,
  templateCategory,
  templateBoon,
  templateTileContent,
  TEMPLATE_FILTERS,
  TEMPLATE_BOON_FILTERS,
  type TemplateFilter,
  type TemplateBoonFilter
} from '#gw2/app/build/library/model.js';

/** Renders library controls and feedback; loading and persistence stay with the feature's actions and controller. */
export function templateSnowCrowsLink(preset: Pick<BuildTemplatePreset, 'snowCrowsUrl'>): string {
  // Only presets with explicit source metadata expose an external build-page action.
  return preset.snowCrowsUrl
    ? `<a href="${esc(preset.snowCrowsUrl)}" target="_blank" rel="noopener noreferrer" role="menuitem">View on Snow Crows</a>`
    : '';
}

function templateButtonHtml(app: ProfessionAppState, preset: BuildTemplatePreset, section: string): string {
  const index = app.templatePresets.push({ ...preset, section }) - 1;
  const label = esc(preset.label);
  const content = templateTileContent(preset);
  const category = templateCategory(preset);
  const boon = templateBoon(preset);
  // Inferno already identifies its variant; other boon builds need a damage-type qualifier in the mixed group.
  const qualifier =
    boon === 'none' || /^Inferno\b/.test(content.weapons)
      ? ''
      : category === 'power'
        ? 'Power '
        : category === 'condi'
          ? 'Condition '
          : '';
  const rotationAction = preset.rotation
    ? `<button type="button" role="menuitem" data-template-action="rotation" data-template-index="${index}">Load rotation only</button>`
    : '';
  // Surface manifest freshness where users choose a template so stale builds are not mistaken for current ones.
  const freshnessWarning =
    preset.upToDate === false
      ? '<span class="template-preset-warning" title="This template may no longer match the current game balance.">⚠ Out of date</span>'
      : '';
  const searchText = [section, preset.label, content.name, content.weapons].filter(Boolean).join(' ').toLowerCase();
  return `<div class="template-preset" data-template-index="${index}" data-template-category="${category}" data-template-boon="${boon}" data-template-specialization="${esc(section)}" data-build-search="${esc(searchText)}">
      <button type="button" class="btn template-load-btn" data-template-action="template" data-template-index="${index}" aria-pressed="false" title="${label}">
        <span class="template-preset-name">${esc(content.weapons ? qualifier + content.weapons : content.name)}</span>
        ${boon === 'none' ? '' : `<span class="template-preset-boon">${boon[0].toUpperCase()}${boon.slice(1)}</span>`}
        ${content.dps ? `<span class="template-preset-dps">${esc(content.dps)}</span>` : ''}
        ${freshnessWarning}
      </button>
      <details class="template-actions">
        <summary aria-label="More options for ${label}" title="More loading options">•••</summary>
        <div class="template-actions-menu" role="menu">
          <button type="button" role="menuitem" data-template-action="new-tab" data-template-index="${index}">Open in new tab</button>
          <button type="button" role="menuitem" data-template-action="build" data-template-index="${index}">Load build only</button>
          ${rotationAction}
          ${templateSnowCrowsLink(preset)}
        </div>
      </details>
    </div>`;
}

export function applyTemplateFilter(
  container: HTMLElement,
  filter: TemplateFilter,
  boonFilter: TemplateBoonFilter,
  specialization: string | null,
  search = ''
): void {
  container.querySelectorAll<HTMLButtonElement>('[data-template-filter]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.templateFilter === filter));
  });
  container.querySelectorAll<HTMLButtonElement>('[data-template-boon-filter]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.templateBoonFilter === boonFilter));
  });
  container.querySelectorAll<HTMLButtonElement>('[data-template-specialization-filter]').forEach((button) => {
    button.setAttribute(
      'aria-pressed',
      String((button.dataset.templateSpecializationFilter || null) === specialization)
    );
  });
  const roleValue = container.querySelector<HTMLElement>('[data-template-role-value]');
  const boonValue = container.querySelector<HTMLElement>('[data-template-boon-value]');
  const specializationValue = container.querySelector<HTMLElement>('[data-template-specialization-value]');
  if (roleValue) roleValue.textContent = filter === 'all' ? 'Any' : filter === 'condi' ? 'Condition' : 'Power';
  if (boonValue)
    boonValue.textContent = boonFilter === 'all' ? 'Any' : boonFilter[0].toUpperCase() + boonFilter.slice(1);
  if (specializationValue) specializationValue.textContent = specialization || 'Any';

  let visibleTemplates = 0;
  container.querySelectorAll<HTMLElement>('[data-library-panel="templates"] .template-preset').forEach((preset) => {
    const matchesDamageType = filter === 'all' || preset.dataset.templateCategory === filter;
    const matchesBoon = boonFilter === 'all' || preset.dataset.templateBoon === boonFilter;
    const matchesSpecialization = specialization === null || preset.dataset.templateSpecialization === specialization;
    const matchesSearch = !search || preset.dataset.buildSearch?.includes(search);
    const visible = matchesDamageType && matchesBoon && matchesSpecialization && matchesSearch;
    preset.hidden = !visible;
    if (visible) visibleTemplates += 1;
  });

  container.querySelectorAll<HTMLElement>('.template-subgroup, .presets-group').forEach((group) => {
    group.hidden = !group.querySelector('.template-preset:not([hidden])');
  });

  const emptyMessage = container.querySelector<HTMLElement>('.template-filter-empty');
  if (emptyMessage) emptyMessage.hidden = visibleTemplates > 0;
}

function templateGroupsHtml(app: ProfessionAppState, manifest: readonly BuildTemplateSection[]): string {
  app.templatePresets = [];
  return manifest
    .map((section) => {
      // Boon builds belong to one support group; native details keep each category independently collapsible.
      const groups: Record<string, string[]> = { Power: [], Condition: [], Boon: [], Other: [] };
      for (const preset of section.presets) {
        const category = templateCategory(preset);
        const group =
          templateBoon(preset) !== 'none'
            ? 'Boon'
            : category === 'power'
              ? 'Power'
              : category === 'condi'
                ? 'Condition'
                : 'Other';
        groups[group].push(templateButtonHtml(app, preset, section.section));
      }

      const templates = Object.entries(groups)
        .filter(([, rows]) => rows.length > 0)
        .map(
          ([name, rows]) => `<details class="template-subgroup" open>
            <summary>${name}</summary>
            <div class="template-subgroup-rows">${rows.join('')}</div>
          </details>`
        )
        .join('');
      if (!templates) return '';
      const label = `<span class="presets-group-label">${esc(section.section)}</span>`;
      return `<div class="presets-group">${label}<div class="presets-group-btns template-preset-list">${templates}</div></div>`;
    })
    .join('');
}

/** Renders durable user snapshots through the existing build-row controls and current search. */
export function renderMyBuilds(container: HTMLElement, builds: readonly MyBuild[], search = ''): void {
  const list = container.querySelector<HTMLElement>('.my-build-list');
  if (!list) return;
  const categories = new Map<string, MyBuild[]>();
  for (const build of builds) {
    const category = build.category || 'Uncategorized';
    categories.set(category, [...(categories.get(category) || []), build]);
  }

  list.innerHTML = [...categories]
    .map(
      ([category, entries]) => `<section class="my-build-group">
        <h4>${esc(category)}</h4>
        <div class="my-build-group-rows">${entries
          .map(({ id, name }) => {
            const escapedId = esc(id);
            const escapedName = esc(name);
            return `<div class="template-preset my-build" data-my-build-id="${escapedId}" data-build-search="${esc(`${category} ${name}`.toLowerCase())}">
              <button type="button" class="btn template-load-btn" data-library-action="load" data-my-build-id="${escapedId}" title="${escapedName}">
                <span class="template-preset-name">${escapedName}</span>
              </button>
              <details class="template-actions">
                <summary aria-label="More options for ${escapedName}" title="More options">•••</summary>
                <div class="template-actions-menu" role="menu">
                  <button type="button" role="menuitem" data-library-action="delete" data-my-build-id="${escapedId}">Delete</button>
                </div>
              </details>
            </div>`;
          })
          .join('')}</div>
      </section>`
    )
    .join('');
  let visible = 0;
  list.querySelectorAll<HTMLElement>('.my-build').forEach((build) => {
    build.hidden = Boolean(search && !build.dataset.buildSearch?.includes(search));
    if (!build.hidden) visible += 1;
  });
  list.querySelectorAll<HTMLElement>('.my-build-group').forEach((group) => {
    group.hidden = !group.querySelector('.my-build:not([hidden])');
  });
  const empty = container.querySelector<HTMLElement>('.my-build-empty');
  if (empty) {
    empty.innerHTML = builds.length
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path></svg>
        <strong>No builds found</strong>
        <span>Try a different search.</span>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11a2 2 0 0 1 2 2v14l-7.5-4L3 20V6a2 2 0 0 1 2-2Z"></path><path d="M8 9h5M10.5 6.5v5"></path></svg>
        <strong>No saved builds yet</strong>
        <span>Use “Save to My Builds” from a build tab's menu to add one.</span>`;
    empty.hidden = visible > 0;
  }
}

/** Switches the dialog's accessible tab state without rebuilding either library view. */
export function showBuildLibraryView(container: HTMLElement, view: 'templates' | 'mine'): void {
  container.querySelectorAll<HTMLButtonElement>('[data-library-view]').forEach((button) => {
    const selected = button.dataset.libraryView === view;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  container.querySelectorAll<HTMLElement>('[data-library-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.libraryPanel !== view;
  });
}

export function closeTemplateMenus(container: ParentNode | null | undefined): void {
  container
    ?.querySelectorAll('.template-actions[open], .template-filter[open]')
    .forEach((details) => details.removeAttribute('open'));
}

function mountBuildTemplateLayout(container: HTMLElement): void {
  const buildEditor = document.querySelector<HTMLElement>('.build-editor');
  if (!buildEditor) return;

  const existingMain = buildEditor.closest<HTMLElement>('.profession-main');
  if (existingMain?.parentElement) {
    existingMain.parentElement.before(container);
    return;
  }

  const appRoot = buildEditor.parentElement;
  if (!appRoot) return;

  const layout = document.createElement('div');
  layout.className = 'profession-layout';
  const main = document.createElement('div');
  main.className = 'profession-main';

  // Move the complete build-and-rotation editor as one unit so it stays contiguous with template feedback above it.
  appRoot.insertBefore(layout, buildEditor);
  layout.append(main);
  while (layout.nextSibling) {
    main.append(layout.nextSibling);
  }

  // The shared toolbar needs its picker, loading status and Undo outside regions hidden by tool navigation.
  layout.before(container);
}

export function updateTemplateSelection(app: ProfessionAppState): void {
  const container = app.templateContainer;
  if (!container) return;
  // The toast follows the active tab's template undo state, just like its selection highlight.
  const toast = container.querySelector<HTMLElement>('.template-toast');
  if (toast) {
    toast.hidden = !app.templateUndoBuild;
    const message = toast.querySelector('.template-toast-message');
    if (message) message.textContent = app.templateUndoMessage || 'Loaded template.';
  }

  const current = app.currentTemplate;
  const modified = Boolean(current && current.signature !== buildSignature(app.build));
  container.querySelectorAll('.template-load-btn').forEach((button) => {
    if (!(button instanceof HTMLElement)) return;
    const preset = app.templatePresets[Number(button.dataset.templateIndex)];
    const selected = Boolean(current && preset?.build === current.build);
    button.classList.toggle('template-load-btn--current', selected);
    button.classList.toggle('template-load-btn--modified', selected && modified);
    button.setAttribute('aria-pressed', String(selected));
  });
}

/** Creates both dialogs while leaving focus, input, and loading actions to the controller. */
export function createBuildLibraryView(
  app: ProfessionAppState,
  manifest: readonly BuildTemplateSection[],
  specializations: readonly string[]
) {
  const groups = templateGroupsHtml(app, manifest);
  const container = document.createElement('section');
  container.className = 'build-templates';
  container.setAttribute('aria-labelledby', 'build-library-title');
  container.innerHTML = `
      <div class="panel build-templates-panel">
        <div class="build-templates-header">
          <div>
            <h3 id="build-library-title">Build library</h3>
          </div>
          <span class="template-actions-hint">••• for partial loading</span>
        </div>
        <div class="build-library-tabs" role="tablist" aria-label="Build library sections">
          <button type="button" role="tab" data-library-view="templates" aria-controls="standard-builds-panel" aria-selected="true">Standard Templates</button>
          <button type="button" role="tab" data-library-view="mine" aria-controls="my-builds-panel" aria-selected="false" tabindex="-1">My Builds</button>
        </div>
        <label class="build-library-search">
          <span>Search builds</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path></svg>
          <input type="search" placeholder="Search builds" autocomplete="off">
        </label>
        <div id="standard-builds-panel" role="tabpanel" data-library-panel="templates">
        <div class="template-filters">
          <details class="template-filter" name="build-template-filter">
            <summary>Role: <strong data-template-role-value>Any</strong></summary>
            <div class="template-filter-menu" role="group" aria-label="Filter build templates by role">
              ${TEMPLATE_FILTERS.map(
                (filter) =>
                  `<button type="button" data-template-filter="${filter}" aria-pressed="${filter === 'all'}">${filter === 'all' ? 'Any' : filter === 'condi' ? 'Condition' : 'Power'}</button>`
              ).join('')}
            </div>
          </details>
          <details class="template-filter" name="build-template-filter">
            <summary>Boon: <strong data-template-boon-value>Any</strong></summary>
            <div class="template-filter-menu" role="group" aria-label="Filter build templates by boon">
              ${TEMPLATE_BOON_FILTERS.map(
                (boon) =>
                  `<button type="button" data-template-boon-filter="${boon}" aria-pressed="${boon === 'all'}">${boon === 'all' ? 'Any' : boon[0].toUpperCase() + boon.slice(1)}</button>`
              ).join('')}
            </div>
          </details>
          <details class="template-filter template-specialization-filter" name="build-template-filter">
            <summary>Specialization: <strong data-template-specialization-value>Any</strong></summary>
            <div class="template-filter-menu" role="group" aria-label="Filter build templates by specialization">
              <button type="button" data-template-specialization-filter="" aria-pressed="true">Any</button>
              ${specializations
                .map(
                  (specialization) =>
                    `<button type="button" data-template-specialization-filter="${esc(specialization)}" aria-pressed="false">${esc(specialization)}</button>`
                )
                .join('')}
            </div>
          </details>
        </div>
        <div class="default-build-groups">${groups}</div>
        <p class="template-filter-empty" ${groups ? 'hidden' : ''}>${groups ? 'No matching build templates.' : 'No standard templates are available.'}</p>
        </div>
        <div id="my-builds-panel" role="tabpanel" data-library-panel="mine" hidden>
          <div class="my-build-list"></div>
          <div class="my-build-empty" hidden></div>
        </div>
        <div class="template-toast" role="status" hidden>
          <span class="template-toast-message"></span>
          <button type="button" data-template-action="undo">Undo</button>
        </div>
      </div>`;

  app.templateContainer = container;
  mountBuildTemplateLayout(container);
  // Every layout browses the same catalog in a native dialog; Undo stays accessible in the editor.
  const panel = container.querySelector('.build-templates-panel')!;
  const toast = container.querySelector('.template-toast')!;
  const dialog = document.createElement('dialog');
  dialog.className = 'build-templates-dialog';
  dialog.id = 'build-templates-dialog';
  dialog.setAttribute('aria-labelledby', 'build-library-title');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn';
  close.textContent = 'Close';
  close.setAttribute('aria-label', 'Close build library');
  close.autofocus = true;
  container.querySelector('.build-templates-header')!.append(close);
  dialog.append(panel);
  const loading = document.createElement('div');
  loading.className = 'template-load-status';
  loading.setAttribute('role', 'status');
  loading.hidden = true;
  const saveDialog = document.createElement('dialog');
  saveDialog.className = 'build-save-dialog';
  saveDialog.setAttribute('aria-labelledby', 'build-save-title');
  saveDialog.innerHTML = `<form>
        <h2 id="build-save-title">Save to My Builds</h2>
        <label for="build-save-target">Save as</label>
        <select id="build-save-target" name="target"></select>
        <label for="build-save-name">Build name</label>
        <input id="build-save-name" name="name" type="text" maxlength="80" required autocomplete="off">
        <label for="build-save-category">Category <span>(optional)</span></label>
        <input id="build-save-category" name="category" type="text" maxlength="80" placeholder="e.g. Raids" autocomplete="off">
        <div class="build-save-actions app-dialog-actions">
          <button type="button" class="btn btn-io" data-dialog-close>Cancel</button>
          <button type="submit" class="btn btn-io">Save</button>
        </div>
      </form>`;

  close.dataset.dialogClose = '';
  container.append(dialog, saveDialog, toast, loading);
  return { container, dialog, saveDialog };
}
