import { escapeHtml as esc } from '#gw2/app/presentation/shared/html.js';
import { bindDialog, showDialog } from '#app/dialog.js';
import { fetchJsonAsset, getRotationItems, loadPresetBundle } from '#gw2/app/build/io/files.js';
import { replaceBuild, replaceBuildConfiguration, replaceBuildRotation } from '#gw2/app/build/state/persistence.js';

import type { BuildTemplatePreset, BuildTemplateSection } from '#gw2/app/build/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2ApplicationBuild } from '#gw2/platform/builds/types.js';

import {
  addBuildTab,
  captureBuildDestination,
  deleteMyBuild,
  loadMyBuilds,
  saveBuildWorkspace,
  saveMyBuild,
  type MyBuild
} from '#gw2/app/build/state/workspace.js';
import { renderBuildTabs } from '#gw2/app/build/panels/workspace-tabs.js';
import { renderTimeline } from '#gw2/app/rotation/timeline/view.js';

type TemplateLoadAction = 'build' | 'rotation' | 'template' | 'new-tab';
type TemplateCategory = 'power' | 'condi' | 'other';
type TemplateFilter = 'all' | Exclude<TemplateCategory, 'other'>;
type TemplateBoon = 'alacrity' | 'quickness' | 'none';
type TemplateBoonFilter = 'all' | Exclude<TemplateBoon, 'none'>;

const TEMPLATE_FILTERS: readonly TemplateFilter[] = ['all', 'power', 'condi'];
const TEMPLATE_BOON_FILTERS: readonly TemplateBoonFilter[] = ['all', 'alacrity', 'quickness'];

function normalizeTemplateSections(manifest: unknown): BuildTemplateSection[] {
  if (!Array.isArray(manifest) || manifest.length === 0) return [];
  const sections = manifest as BuildTemplateSection[];
  return sections[0]?.presets !== undefined
    ? sections
    : [
        {
          section: null,
          presets: manifest as BuildTemplatePreset[]
        }
      ];
}

export function templateSpecializations(manifest: unknown): string[] {
  // Manifest sections represent active specializations, so they can drive the filter without loading every build file.
  return [
    ...new Set(
      normalizeTemplateSections(manifest).flatMap((section) => {
        const specialization = section.section?.trim();
        return specialization ? [specialization] : [];
      })
    )
  ];
}

export function templateTileContent(preset: BuildTemplatePreset): {
  name: string;
  weapons: string;
  dps: string;
} {
  // Split manifest labels into role, weapons, and benchmark text so every tile keeps the requested visual hierarchy.
  const category = templateCategory(preset);
  const boon = templateBoon(preset);
  const weaponMatch = preset.label.match(/\(([^()]*)\)/);
  const detailsStart = weaponMatch?.index ?? preset.label.length;
  const name =
    category === 'other'
      ? preset.label
          .slice(0, detailsStart)
          .replace(/\s*-\s*$/, '')
          .trim()
      : `${category === 'condi' ? 'Condition' : 'Power'}${boon === 'none' ? '' : ` ${boon[0].toUpperCase()}${boon.slice(1)}`}`;
  const roleSuffix = preset.label
    .slice(name.length, detailsStart)
    .replace(/\s*-\s*$/, '')
    .trim();
  const weapons = (weaponMatch?.[1].match(/^\d+\s+Kits?$/i) ? roleSuffix : weaponMatch?.[1] || roleSuffix).replace(
    /\s*\/\s*/g,
    ' & '
  );
  const benchmarkDps = Number(preset.benchmarkDps);
  // Keep trailing variant labels visible so builds with the same weapons remain distinguishable.
  const variant = weaponMatch ? preset.label.slice(detailsStart + weaponMatch[0].length).trim() : '';
  // Keep Inferno visible beside the weapons so power presets remain distinguishable in the picker.
  const inferno = category === 'power' && /\binferno\b/i.test(`${preset.label} ${preset.build}`);

  return {
    name,
    weapons: [inferno ? 'Inferno' : '', weapons, variant].filter(Boolean).join(' '),
    dps:
      Number.isFinite(benchmarkDps) && benchmarkDps > 0 ? `${Math.round(benchmarkDps).toLocaleString('en-US')} DPS` : ''
  };
}

export function templateCategory(preset: Pick<BuildTemplatePreset, 'label' | 'build'>): TemplateCategory {
  const description = `${preset.label} ${preset.build}`.toLowerCase();
  // Inferno presets use power gear but omit the damage type from their display name.
  if (/\b(?:power|inferno)\b|\/b-power-/.test(description)) return 'power';
  if (/\b(?:condi|condition)\b|\/b-condi(?:tion)?-/.test(description)) {
    return 'condi';
  }

  return 'other';
}

export function templateBoon(preset: Pick<BuildTemplatePreset, 'label' | 'build'>): TemplateBoon {
  // Template names encode support roles, so the selector can filter them without loading every build asset.
  const description = `${preset.label} ${preset.build}`.toLowerCase();
  if (/\balacrity\b|[-/]alac-/.test(description)) return 'alacrity';
  if (/\bquickness\b|[-/]quick-/.test(description)) return 'quickness';
  return 'none';
}

export function templateSnowCrowsLink(preset: Pick<BuildTemplatePreset, 'snowCrowsUrl'>): string {
  // Only presets with explicit source metadata expose an external build-page action.
  return preset.snowCrowsUrl
    ? `<a href="${esc(preset.snowCrowsUrl)}" target="_blank" rel="noopener noreferrer" role="menuitem">View on Snow Crows</a>`
    : '';
}

function isTemplateFilter(value: string | undefined): value is TemplateFilter {
  return TEMPLATE_FILTERS.includes(value as TemplateFilter);
}

function isTemplateBoonFilter(value: string | undefined): value is TemplateBoonFilter {
  return TEMPLATE_BOON_FILTERS.includes(value as TemplateBoonFilter);
}

function templateButtonHtml(app: ProfessionAppState, preset: BuildTemplatePreset, section: string | null): string {
  const index = app.templatePresets.push({ ...preset, section }) - 1;
  const label = esc(preset.label);
  const content = templateTileContent(preset);
  const category = templateCategory(preset);
  const boon = templateBoon(preset);
  // Boon groups mix damage types, so qualify their names while other groups supply that context.
  const qualifier = boon === 'none' ? '' : category === 'power' ? 'Power ' : category === 'condi' ? 'Condition ' : '';
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

function applyTemplateFilter(
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
  container
    .querySelectorAll<HTMLElement>('[data-library-panel="templates"] .template-preset')
    .forEach((preset) => {
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

function templateGroupsHtml(app: ProfessionAppState, manifest: unknown): string {
  app.templatePresets = [];
  return normalizeTemplateSections(manifest)
    .map((section) => {
      // Boon builds belong to one support group; native details keep each category independently collapsible.
      const groups: Record<string, string[]> = { Power: [], Condition: [], Boon: [], Other: [] };
      for (const preset of section.presets || []) {
        const category = templateCategory(preset);
        const group =
          templateBoon(preset) !== 'none'
            ? 'Boon'
            : category === 'power'
              ? 'Power'
              : category === 'condi'
                ? 'Condition'
                : 'Other';
        groups[group].push(templateButtonHtml(app, preset, section.section || null));
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
      const label = section.section ? `<span class="presets-group-label">${esc(section.section)}</span>` : '';
      return `<div class="presets-group">${label}<div class="presets-group-btns template-preset-list">${templates}</div></div>`;
    })
    .join('');
}

/** Renders durable user snapshots through the existing build-row controls and current search. */
function renderMyBuilds(container: HTMLElement, builds: readonly MyBuild[], search = ''): void {
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
        <span>Use “Save to My Builds” from a build tab’s menu to add one.</span>`;
    empty.hidden = visible > 0;
  }
}

/** Switches the dialog's accessible tab state without rebuilding either library view. */
function showBuildLibraryView(container: HTMLElement, view: 'templates' | 'mine'): void {
  container.querySelectorAll<HTMLButtonElement>('[data-library-view]').forEach((button) => {
    const selected = button.dataset.libraryView === view;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  container.querySelectorAll<HTMLElement>('[data-library-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.libraryPanel !== view;
  });
}

/** Loads a saved snapshot into the intended open tab, retaining the same reset and Undo behavior as templates. */
function loadMyBuildEntry(app: ProfessionAppState, entry: MyBuild): void {
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
  app.build = replaceBuild(entry.build, app.adapter);
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

function buildSignature(build: Gw2ApplicationBuild): string {
  return JSON.stringify(build);
}

function validateBuildProfession(app: ProfessionAppState, buildData: unknown): void {
  if (!buildData || typeof buildData !== 'object') return;
  const profession = (buildData as { profession?: unknown }).profession;
  if (profession && profession !== app.adapter.id) {
    throw new Error(`This is a ${String(profession)} build.`);
  }
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

function showTemplateUndo(app: ProfessionAppState, message: string, previousBuild: Gw2ApplicationBuild): void {
  app.templateUndoBuild = previousBuild;
  app.templateUndoMessage = message;
  const toast = app.templateContainer?.querySelector<HTMLElement>('.template-toast');
  if (!toast) return;
  toast.hidden = false;
  const messageElement = toast.querySelector('.template-toast-message');
  if (messageElement) messageElement.textContent = message;
}

function closeTemplateMenus(container: ParentNode | null | undefined): void {
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

export async function initBuildTemplates(app: ProfessionAppState): Promise<void> {
  let manifest: unknown = [];
  try {
    manifest = await fetchJsonAsset(`data/gw2/builds/${app.adapter.id}/manifest.json`, { optional: true });
  } catch (error) {
    // The user's local library remains available even when the standard catalog cannot be fetched.
    console.error(`Failed to load build templates for ${app.adapter.id}:`, error);
  }

  try {
    const groups = templateGroupsHtml(app, manifest);
    const specializations = templateSpecializations(manifest);
    let myBuilds = loadMyBuilds(app.adapter);

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
    renderMyBuilds(container, myBuilds);
    app.templateContainer = container;
    mountBuildTemplateLayout(container);
    {
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
          myBuilds = saveMyBuild(app, myBuilds, name.value, target.value || undefined, category.value);
          const search = container.querySelector<HTMLInputElement>('.build-library-search input')!.value
            .trim()
            .toLowerCase();
          renderMyBuilds(container, myBuilds, search);
          saveDialog.close();
        } catch (error) {
          alert(`Failed to save build: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
      container.append(dialog, saveDialog, toast, loading);
      close.dataset.dialogClose = '';
      bindDialog(dialog);
      bindDialog(saveDialog);
      saveDialog.addEventListener('close', () => saveTrigger?.focus({ preventScroll: true }));
      container.addEventListener('open-build-save', (event) => {
        saveTrigger = (event as CustomEvent<HTMLElement>).detail || null;
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
            myBuilds = deleteMyBuild(app, myBuilds, entry.id);
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
      validateBuildProfession(app, buildData);
      validateDestination();
      app.build = replaceBuildConfiguration(buildData, app.build, app.adapter);
      app.currentTemplate = null;
      app.changed(true, true, { deferRotationRender: true });
    } else {
      const { buildData, rotationItems } = await loadPresetBundle(preset);
      validateBuildProfession(app, buildData);
      if (preset.rotation && !Array.isArray(rotationItems)) {
        throw new Error('Rotation array missing.');
      }

      // Validate the complete bundle before creating a tab or replacing the destination build.
      const build = replaceBuildConfiguration(buildData, previousBuild, app.adapter);
      const replacement = replaceBuildRotation(Array.isArray(rotationItems) ? rotationItems : [], build, app.adapter);
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
