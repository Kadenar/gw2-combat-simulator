import { addBuildTab, closeBuildTab, saveBuildWorkspace } from '#gw2/app/build/state/workspace.js';
import { escapeHtml } from '#gw2/app/presentation/shared/html.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

/** Keeps one editor mounted while ordinary buttons select independent build sessions. */
export function mountBuildTabs(app: ProfessionAppState): void {
  if (!app.workspace || document.getElementById('build-workspace-tabs')) return;
  const editor = document.querySelector('.build-editor');
  if (!editor) return;
  const strip = document.createElement('section');
  strip.id = 'build-workspace-tabs';
  strip.className = 'build-workspace-tabs';
  strip.setAttribute('aria-label', 'Build tabs');
  editor.before(strip);
  strip.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || !app.workspace) return;
    const action = button.dataset.buildTabAction;
    const id = button.dataset.buildTabId;
    if (action === 'select' && id) app.activateBuildTab?.(id);
    if (action === 'new') addBuildTab(app);
    if (action === 'duplicate') {
      const active = app.workspace.tabs.find((tab) => tab.id === app.workspace?.activeTabId)!;
      addBuildTab(app, app.build, `${active.name} copy`);
    }

    if (action === 'rename' && id) {
      const tab = app.workspace.tabs.find((entry) => entry.id === id)!;
      const name = window.prompt('Build tab name', tab.name)?.trim();
      if (name) {
        tab.name = name.slice(0, 80);
        saveBuildWorkspace(app);
      }
    }

    if (action === 'close' && id) closeBuildTab(app, id);
    renderBuildTabs(app);
    // Replacing the strip must retain a usable focus target after the clicked control disappears.
    const focusAction = action === 'duplicate' || action === 'new' ? action : 'select';
    strip
      .querySelector<HTMLButtonElement>(
        focusAction === 'select' ? 'button[aria-pressed="true"]' : `[data-build-tab-action="${focusAction}"]`
      )
      ?.focus({ preventScroll: true });
  });
  renderBuildTabs(app);
}

/** Names are escaped and tab overflow stays inside the strip, including narrow screens. */
export function renderBuildTabs(app: ProfessionAppState): void {
  if (!app.workspace || typeof document === 'undefined') return;
  const strip = document.getElementById('build-workspace-tabs');
  const workspace = app.workspace;
  if (!strip || !workspace) return;
  const scroller = strip.querySelector('.build-tab-list');
  const scrollLeft = scroller?.scrollLeft || 0;
  strip.innerHTML = `
    <div class="build-tab-list" role="group" aria-label="Open builds">
      ${workspace.tabs
        .map((tab) => {
          const selected = tab.id === workspace.activeTabId;
          const name = escapeHtml(tab.name);
          const id = escapeHtml(tab.id);
          return `<div class="build-tab${selected ? ' is-active' : ''}">
          <button type="button" data-build-tab-action="select" data-build-tab-id="${id}" aria-pressed="${selected}" title="${name}">${name}</button>
          <button type="button" class="build-tab-rename" data-build-tab-action="rename" data-build-tab-id="${id}" aria-label="Rename ${name}" title="Rename ${name}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m16 3 5 5-13 13H3v-5Z"/><path d="m14 5 5 5"/></svg></button>
          ${workspace.tabs.length > 1 ? `<button type="button" class="build-tab-close" data-build-tab-action="close" data-build-tab-id="${id}" aria-label="Close ${name}">&times;</button>` : ''}
        </div>`;
        })
        .join('')}
    </div>
    <div class="build-tab-actions">
      <button type="button" class="btn btn-io" data-build-tab-action="new">+ New build</button>
      <button type="button" class="btn btn-io" data-build-tab-action="duplicate">Duplicate</button>
    </div>
    ${workspace.storageError ? `<div class="build-tab-notice" role="status">${escapeHtml(workspace.storageError)}</div>` : ''}`;
  const list = strip.querySelector<HTMLElement>('.build-tab-list')!;
  list.scrollLeft = scrollLeft;
  const selected = list.querySelector<HTMLElement>('.is-active');
  if (selected) {
    const bounds = selected.getBoundingClientRect();
    const visible = list.getBoundingClientRect();
    if (bounds.left < visible.left) list.scrollLeft -= visible.left - bounds.left;
    else if (bounds.right > visible.right) list.scrollLeft += bounds.right - visible.right;
  }
}
