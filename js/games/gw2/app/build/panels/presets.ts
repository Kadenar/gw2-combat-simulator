import { escapeHtml as esc } from '../../presentation/shared/html.js';
import { fetchJsonAsset, getRotationItems, loadPresetBundle } from '../io/files.js';
import { replaceBuildConfiguration, replaceBuildRotation } from '../state/persistence.js';

import type {
  BuildTemplatePreset,
  BuildTemplateSection,
  ProfessionAppState,
  ProfessionApplicationBuild
} from '../../types.js';

type TemplateLoadAction = 'build' | 'rotation' | 'template';
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
      ? preset.label.slice(0, detailsStart).replace(/\s*-\s*$/, '').trim()
      : `${category === 'condi' ? 'Condition' : 'Power'}${boon === 'none' ? '' : ` ${boon[0].toUpperCase()}${boon.slice(1)}`}`;
  const roleSuffix = preset.label.slice(name.length, detailsStart).replace(/\s*-\s*$/, '').trim();
  const weapons = (weaponMatch?.[1].match(/^\d+\s+Kits?$/i) ? roleSuffix : weaponMatch?.[1] || roleSuffix).replace(
    /\s*\/\s*/g,
    ' & '
  );
  const benchmarkDps = Number(preset.benchmarkDps);

  return {
    name,
    weapons,
    dps:
      Number.isFinite(benchmarkDps) && benchmarkDps > 0
        ? `${Math.round(benchmarkDps).toLocaleString('en-US')} DPS`
        : ''
  };
}

export function templateCategory(preset: Pick<BuildTemplatePreset, 'label' | 'build'>): TemplateCategory {
  const description = `${preset.label} ${preset.build}`.toLowerCase();
  if (/\bpower\b|\/b-power-/.test(description)) return 'power';
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

export function templateHasBoon(preset: Pick<BuildTemplatePreset, 'label' | 'build'>): boolean {
  return templateBoon(preset) !== 'none';
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

/**
 * @param {ProfessionAppState} app
 * @param {BuildTemplatePreset} preset
 * @param {string | null} section
 * @returns {string}
 */
function templateButtonHtml(app: ProfessionAppState, preset: BuildTemplatePreset, section: string | null): string {
  const index = app.templatePresets.push({ ...preset, section }) - 1;
  const label = esc(preset.label);
  const content = templateTileContent(preset);
  const category = templateCategory(preset);
  const boon = templateBoon(preset);
  const rotationAction = preset.rotation
    ? `<button type="button" role="menuitem" data-template-action="rotation" data-template-index="${index}">Load rotation only</button>`
    : '';
  return `<div class="template-preset" data-template-index="${index}" data-template-category="${category}" data-template-boon="${boon}" data-template-specialization="${esc(section)}">
      <button type="button" class="btn template-load-btn" data-template-action="template" data-template-index="${index}" aria-pressed="false">
        <span class="template-preset-name">${esc(content.name)}</span>
        <span class="template-preset-weapons">${esc(content.weapons)}</span>
        ${content.dps ? `<span class="template-preset-dps">${esc(content.dps)}</span>` : ''}
      </button>
      <details class="template-actions">
        <summary aria-label="More options for ${label}" title="More loading options">•••</summary>
        <div class="template-actions-menu" role="menu">
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
  specialization: string | null
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
  if (boonValue) boonValue.textContent = boonFilter === 'all' ? 'Any' : boonFilter[0].toUpperCase() + boonFilter.slice(1);
  if (specializationValue) specializationValue.textContent = specialization || 'Any';

  let visibleTemplates = 0;
  container.querySelectorAll<HTMLElement>('.template-preset').forEach((preset) => {
    const matchesDamageType = filter === 'all' || preset.dataset.templateCategory === filter;
    const matchesBoon = boonFilter === 'all' || preset.dataset.templateBoon === boonFilter;
    const matchesSpecialization = specialization === null || preset.dataset.templateSpecialization === specialization;
    const visible = matchesDamageType && matchesBoon && matchesSpecialization;
    preset.hidden = !visible;
    if (visible) visibleTemplates += 1;
  });

  container.querySelectorAll<HTMLElement>('.presets-group').forEach((group) => {
    group.hidden = !group.querySelector('.template-preset:not([hidden])');
  });

  const emptyMessage = container.querySelector<HTMLElement>('.template-filter-empty');
  if (emptyMessage) emptyMessage.hidden = visibleTemplates > 0;
}

/**
 * @param {ProfessionAppState} app
 * @param {unknown} manifest
 * @returns {string}
 */
function templateGroupsHtml(app: ProfessionAppState, manifest: unknown): string {
  app.templatePresets = [];
  return normalizeTemplateSections(manifest)
    .map((section) => {
      const templates = (section.presets || [])
        .map((preset) => templateButtonHtml(app, preset, section.section || null))
        .join('');
      if (!templates) return '';
      const label = section.section ? `<span class="presets-group-label">${esc(section.section)}</span>` : '';
      return `<div class="presets-group">${label}<div class="presets-group-btns template-preset-list">${templates}</div></div>`;
    })
    .join('');
}

/**
 * @param {ProfessionApplicationBuild} build
 * @returns {string}
 */
function buildSignature(build: ProfessionApplicationBuild): string {
  return JSON.stringify(build);
}

/**
 * @param {ProfessionAppState} app
 * @param {unknown} buildData
 * @returns {void}
 */
function validateBuildProfession(app: ProfessionAppState, buildData: unknown): void {
  if (!buildData || typeof buildData !== 'object') return;
  const profession = (buildData as { profession?: unknown }).profession;
  if (profession && profession !== app.adapter.id) {
    throw new Error(`This is a ${String(profession)} build.`);
  }
}

/**
 * @param {TemplateLoadAction} action
 * @returns {string}
 */
function actionLabel(action: TemplateLoadAction): string {
  if (action === 'build') return 'build';
  if (action === 'rotation') return 'rotation';
  return 'template';
}

/**
 * @param {BuildTemplatePreset} preset
 * @param {TemplateLoadAction} action
 * @returns {string}
 */
function loadedMessage(preset: BuildTemplatePreset, action: TemplateLoadAction): string {
  const name = preset.section ? `${preset.section} ${preset.label}` : preset.label;
  if (action === 'build') return `Loaded the ${name} build only.`;
  if (action === 'rotation') return `Loaded the ${name} rotation only.`;
  return `Loaded the ${name} template.`;
}

/**
 * @param {ProfessionAppState} app
 * @param {string} message
 * @param {ProfessionApplicationBuild} previousBuild
 * @returns {void}
 */
function showTemplateUndo(app: ProfessionAppState, message: string, previousBuild: ProfessionApplicationBuild): void {
  app.templateUndoBuild = previousBuild;
  const toast = app.templateContainer?.querySelector<HTMLElement>('.template-toast');
  if (!toast) return;
  toast.hidden = false;
  const messageElement = toast.querySelector('.template-toast-message');
  if (messageElement) messageElement.textContent = message;
}

/**
 * @param {ParentNode | null | undefined} container
 * @returns {void}
 */
function closeTemplateMenus(container: ParentNode | null | undefined): void {
  container
    ?.querySelectorAll('.template-actions[open], .template-filter[open]')
    .forEach((details) => details.removeAttribute('open'));
}

/**
 * @param {HTMLElement} container
 * @returns {void}
 */
function mountBuildTemplateLayout(container: HTMLElement): void {
  const buildEditor = document.querySelector<HTMLElement>('.build-editor');
  if (!buildEditor) return;

  const existingMain = buildEditor.closest<HTMLElement>('.profession-main');
  if (existingMain?.parentElement) {
    const layout = existingMain.parentElement;
    let templateRegion = layout.querySelector<HTMLElement>(':scope > .build-templates-region');
    if (!templateRegion) {
      templateRegion = document.createElement('aside');
      templateRegion.className = 'build-templates-region';
      layout.insertBefore(templateRegion, existingMain);
    }

    templateRegion.append(container);
    return;
  }

  const appRoot = buildEditor.parentElement;
  if (!appRoot) return;

  const layout = document.createElement('div');
  layout.className = 'profession-layout';
  const templateRegion = document.createElement('aside');
  templateRegion.className = 'build-templates-region';
  const main = document.createElement('div');
  main.className = 'profession-main';

  // Move the complete build-and-rotation editor as one unit so it stays contiguous beside templates.
  appRoot.insertBefore(layout, buildEditor);
  layout.append(templateRegion, main);
  templateRegion.append(container);
  while (layout.nextSibling) {
    main.append(layout.nextSibling);
  }

  appRoot.classList.add('has-template-sidebar');
}

/**
 * @param {ProfessionAppState} app
 * @returns {Promise<void>}
 */
export async function initBuildTemplates(app: ProfessionAppState): Promise<void> {
  try {
    const manifest = await fetchJsonAsset(`data/gw2/builds/${app.adapter.id}/manifest.json`, { optional: true });
    if (!Array.isArray(manifest) || manifest.length === 0) return;
    const groups = templateGroupsHtml(app, manifest);
    if (!groups) return;
    const specializations = templateSpecializations(manifest);

    const container = document.createElement('section');
    container.className = 'build-templates';
    container.setAttribute('aria-labelledby', 'build-templates-title');
    container.innerHTML = `
      <div class="panel build-templates-panel">
        <div class="build-templates-header">
          <div>
            <h3 id="build-templates-title">Build templates</h3>
          </div>
          <span class="template-actions-hint">••• for partial loading</span>
        </div>
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
        <p class="template-filter-empty" hidden>No matching build templates.</p>
        <div class="template-toast" role="status" hidden>
          <span class="template-toast-message"></span>
          <button type="button" data-template-action="undo">Undo</button>
        </div>
      </div>`;
    app.templateContainer = container;
    mountBuildTemplateLayout(container);
    let templateFilter: TemplateFilter = 'all';
    let boonFilter: TemplateBoonFilter = 'all';
    let specializationFilter: string | null = null;
    container.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const filterButton = target.closest('[data-template-filter]');
      if (filterButton instanceof HTMLButtonElement) {
        const filter = filterButton.dataset.templateFilter;
        if (isTemplateFilter(filter)) {
          templateFilter = filter;
          filterButton.closest('details')?.removeAttribute('open');
          applyTemplateFilter(container, templateFilter, boonFilter, specializationFilter);
        }

        return;
      }

      const boonFilterButton = target.closest('[data-template-boon-filter]');
      if (boonFilterButton instanceof HTMLButtonElement) {
        const boon = boonFilterButton.dataset.templateBoonFilter;
        if (isTemplateBoonFilter(boon)) {
          boonFilter = boon;
          boonFilterButton.closest('details')?.removeAttribute('open');
          applyTemplateFilter(container, templateFilter, boonFilter, specializationFilter);
        }

        return;
      }

      const specializationFilterButton = target.closest('[data-template-specialization-filter]');
      if (specializationFilterButton instanceof HTMLButtonElement) {
        const specialization = specializationFilterButton.dataset.templateSpecializationFilter || null;
        if (specialization === null || specializations.includes(specialization)) {
          specializationFilter = specialization;
          specializationFilterButton.closest('details')?.removeAttribute('open');
          applyTemplateFilter(container, templateFilter, boonFilter, specializationFilter);
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

      if (action !== 'build' && action !== 'rotation' && action !== 'template') {
        return;
      }

      const preset = app.templatePresets[Number(button.dataset.templateIndex)];
      if (!preset) return;
      closeTemplateMenus(container);
      loadTemplateAction(app, preset, action, button);
    });
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof Element && !target.closest('.template-actions, .template-filter')) {
        closeTemplateMenus(container);
      }
    });
    updateTemplateSelection(app);
  } catch {
    // Build templates are optional; import/export remains available without them.
  }
}

/**
 * @param {ProfessionAppState} app
 * @param {BuildTemplatePreset} preset
 * @param {TemplateLoadAction} action
 * @param {HTMLButtonElement} button
 * @returns {Promise<void>}
 */
export async function loadTemplateAction(
  app: ProfessionAppState,
  preset: BuildTemplatePreset,
  action: TemplateLoadAction,
  button: HTMLButtonElement
): Promise<void> {
  const originalContent = button.innerHTML;
  const previousBuild = structuredClone(app.build);
  button.disabled = true;
  button.textContent = 'Loading…';
  try {
    if (action === 'rotation') {
      if (!preset.rotation) {
        throw new Error('Rotation asset missing.');
      }

      const rotationData = await fetchJsonAsset(preset.rotation);
      const rotationItems = getRotationItems(rotationData);
      if (!Array.isArray(rotationItems)) {
        throw new Error('Rotation array missing.');
      }

      app.build = replaceBuildRotation(rotationItems, app.build, app.adapter);
      app.currentTemplate = null;
      app.changed(false, false, { deferRotationRender: true });
    } else if (action === 'build') {
      const buildData = await fetchJsonAsset(preset.build);
      validateBuildProfession(app, buildData);
      app.build = replaceBuildConfiguration(buildData, app.build, app.adapter);
      app.currentTemplate = null;
      app.changed(true, true, { deferRotationRender: true });
    } else {
      const { buildData, rotationItems } = await loadPresetBundle(preset);
      validateBuildProfession(app, buildData);
      if (preset.rotation && !Array.isArray(rotationItems)) {
        throw new Error('Rotation array missing.');
      }

      app.build = replaceBuildConfiguration(buildData, app.build, app.adapter);
      app.build = replaceBuildRotation(Array.isArray(rotationItems) ? rotationItems : [], app.build, app.adapter);
      app.changed(true, true, { deferRotationRender: true });
      app.currentTemplate = {
        build: preset.build,
        signature: buildSignature(app.build)
      };
      updateTemplateSelection(app);
    }

    showTemplateUndo(app, loadedMessage(preset, action), previousBuild);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    alert(`Failed to load ${actionLabel(action)}: ${message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = originalContent;
  }
}

/**
 * @param {ProfessionAppState} app
 * @returns {void}
 */
export function updateTemplateSelection(app: ProfessionAppState): void {
  const container = app.templateContainer;
  if (!container) return;
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

/**
 * @param {ProfessionAppState} app
 * @returns {void}
 */
export function undoTemplateLoad(app: ProfessionAppState): void {
  if (!app.templateUndoBuild) return;
  app.build = app.templateUndoBuild;
  app.templateUndoBuild = null;
  app.currentTemplate = null;
  app.changed(true, true, { deferRotationRender: true });
  const toast = app.templateContainer?.querySelector<HTMLElement>('.template-toast');
  if (toast) toast.hidden = true;
}
