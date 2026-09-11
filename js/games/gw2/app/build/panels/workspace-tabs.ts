import { bindDialog, showDialog } from '#app/dialog.js';
import { addBuildTab, closeBuildTab, saveBuildWorkspace } from '#gw2/app/build/state/workspace.js';
import { escapeHtml } from '#gw2/app/presentation/shared/html.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

/** Edits the chosen tab in a modal without changing the active build or saving cancelled input. */
function openBuildRenameDialog(app: ProfessionAppState, id: string): void {
  const tab = app.workspace?.tabs.find((entry) => entry.id === id);
  if (!tab) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'build-rename-dialog';
  dialog.setAttribute('aria-labelledby', 'build-rename-title');
  dialog.innerHTML = `<form>
    <h2 id="build-rename-title">Rename build</h2>
    <label for="build-rename-name">Build name</label>
    <input id="build-rename-name" name="name" type="text" maxlength="80" required autocomplete="off" autofocus>
    <div class="build-rename-actions app-dialog-actions">
      <button type="button" class="btn btn-io" data-dialog-close>Cancel</button>
      <button type="submit" class="btn btn-io">Save</button>
    </div>
  </form>`;
  const input = dialog.querySelector('input')!;
  const save = dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  input.value = tab.name;
  input.addEventListener('input', () => {
    save.disabled = !input.value.trim();
  });
  dialog.querySelector('form')!.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    tab.name = name.slice(0, 80);
    saveBuildWorkspace(app);
    dialog.close();
  });
  bindDialog(dialog);
  dialog.addEventListener('close', () => {
    dialog.remove();
    renderBuildTabs(app);
    document
      .querySelector<HTMLButtonElement>(`.build-tab-menu-trigger[data-build-tab-id="${CSS.escape(id)}"]`)
      ?.focus({ preventScroll: true });
  });
  document.body.append(dialog);
  input.addEventListener('focus', () => input.select(), { once: true });
  showDialog(dialog);
}

/** Keeps one editor mounted while ordinary buttons select independent build sessions. */
export function mountBuildTabs(app: ProfessionAppState): void {
  if (!app.workspace || document.getElementById('build-workspace-tabs')) return;
  const header = document.querySelector('#app > header');
  if (!header) return;
  const strip = document.createElement('section');
  strip.id = 'build-workspace-tabs';
  strip.className = 'build-workspace-tabs';
  strip.setAttribute('aria-label', 'Build tabs');
  strip.innerHTML = `
    <div class="build-tab-list" role="group" aria-label="Open builds"></div>
    <button type="button" class="btn btn-io build-tab-new" popovertarget="build-new-menu">+ New <span aria-hidden="true">▾</span></button>
    <div id="build-new-menu" class="build-toolbar-menu" popover="auto" role="group" aria-label="New build options">
      <button type="button" data-build-tab-action="new">New blank build</button>
      ${app.templateContainer ? '<button type="button" data-build-tab-action="browse">Browse templates…</button>' : ''}
    </div>
    <div class="build-tab-actions">
      <div class="build-toolbar-io"></div>
      <button type="button" id="build-actions-trigger" class="btn btn-io" popovertarget="build-actions-menu" aria-label="Build actions"><span aria-hidden="true">•••</span><span class="build-actions-label"> Actions ▾</span></button>
    </div>
    <div id="build-actions-menu" class="build-toolbar-menu" popover="auto" role="group" aria-label="Build actions">
      <div class="build-menu-io"></div>
    </div>
    <div id="build-tab-menu" class="build-toolbar-menu" popover="auto" role="group" aria-label="Tab options">
      <button type="button" data-build-tab-action="load" ${app.templateContainer ? '' : 'disabled'}>Load template…</button>
      <button type="button" data-build-tab-action="rename">Rename</button>
      <button type="button" data-build-tab-action="duplicate">Duplicate tab</button>
      <button type="button" data-build-tab-action="close">Close tab</button>
    </div>
    <div class="build-tab-notice" role="status" hidden></div>`;
  // Keep build switching and file actions inside the sticky header in every simulator view.
  header.append(strip);
  // Move the bound controls intact so export, import, and reset keep their existing behavior.
  const reset = document.getElementById('btn-reset-build')!;
  reset.textContent = 'Reset build';
  const tabMenu = strip.querySelector<HTMLElement>('#build-tab-menu')!;
  tabMenu.querySelector('[data-build-tab-action="close"]')!.before(reset);
  // Reset's existing listener must see the chosen tab before it changes the editor.
  reset.addEventListener('click', () => app.activateBuildTab?.(tabMenu.dataset.buildTabId!), { capture: true });
  const ioButtons = ['btn-export-build', 'btn-import-build'].map((id) => document.getElementById(id)!);
  const narrow = window.matchMedia('(max-width: 600px)');
  const placeIo = () => {
    strip.querySelector<HTMLElement>(':popover-open')?.hidePopover();
    strip.querySelector(narrow.matches ? '.build-menu-io' : '.build-toolbar-io')!.append(...ioButtons);
  };

  placeIo();
  narrow.addEventListener('change', placeIo);
  // Native popovers supply outside-click/Escape dismissal; clamp each dropdown inside the iframe.
  strip.querySelectorAll<HTMLElement>('[popover]').forEach((menu) => {
    menu.addEventListener('toggle', () => {
      if (!menu.matches(':popover-open')) return;
      const trigger = strip.querySelector<HTMLButtonElement>(
        `[popovertarget="${menu.id}"]${menu.dataset.buildTabId ? `[data-build-tab-id="${CSS.escape(menu.dataset.buildTabId)}"]` : ''}`
      )!;
      const bounds = trigger.getBoundingClientRect();
      menu.style.left = `${Math.max(8, Math.min(bounds.left, innerWidth - menu.offsetWidth - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(bounds.bottom + 4, innerHeight - menu.offsetHeight - 8))}px`;
      menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    });
  });
  strip.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || !app.workspace) return;
    const action = button.dataset.buildTabAction;
    if (button.hasAttribute('popovertarget')) {
      if (button.dataset.buildTabId) {
        if (tabMenu.dataset.buildTabId !== button.dataset.buildTabId && tabMenu.matches(':popover-open'))
          tabMenu.hidePopover();
        tabMenu.dataset.buildTabId = button.dataset.buildTabId;
        tabMenu.querySelector<HTMLButtonElement>('[data-build-tab-action="close"]')!.disabled =
          app.workspace.tabs.length === 1;
      }

      return;
    }

    const menu = button.closest<HTMLElement>('[popover]');
    menu?.hidePopover();
    const trigger =
      menu &&
      strip.querySelector<HTMLButtonElement>(
        `[popovertarget="${menu.id}"]${menu.dataset.buildTabId ? `[data-build-tab-id="${CSS.escape(menu.dataset.buildTabId)}"]` : ''}`
      );
    trigger?.focus({ preventScroll: true });
    if (!action) return;
    const id = button.dataset.buildTabId || menu?.dataset.buildTabId || app.workspace.activeTabId;
    if (action === 'browse' || action === 'load') {
      if (action === 'load') {
        app.activateBuildTab?.(id);
        strip
          .querySelector<HTMLButtonElement>(`.build-tab-menu-trigger[data-build-tab-id="${CSS.escape(id)}"]`)
          ?.focus({ preventScroll: true });
      }

      if (app.templateContainer) app.templateContainer.dataset.newBuild = String(action === 'browse');
      const dialog = document.querySelector<HTMLDialogElement>('#build-templates-dialog');
      if (dialog) {
        // Loading can rename and rerender the tab before the dialog closes; restore focus to its new trigger.
        if (action === 'load')
          dialog.addEventListener(
            'close',
            () => {
              strip
                .querySelector<HTMLButtonElement>(`.build-tab-menu-trigger[data-build-tab-id="${CSS.escape(id)}"]`)
                ?.focus({ preventScroll: true });
            },
            { once: true }
          );
        showDialog(dialog);
      }

      return;
    }

    if (action === 'select' && id) app.activateBuildTab?.(id);
    if (action === 'new') addBuildTab(app);
    if (action === 'duplicate') {
      const tab = app.workspace.tabs.find((tab) => tab.id === id)!;
      const active = id === app.workspace.activeTabId;
      addBuildTab(
        app,
        active ? app.build : tab.build,
        `${tab.name} copy`,
        active ? app.patchId : tab.patchId,
        tab.templateBuild
      );
    }

    if (action === 'rename' && id) {
      openBuildRenameDialog(app, id);
      return;
    }

    if (action === 'close' && id && confirm('Delete this build? This cannot be undone.')) closeBuildTab(app, id);
    renderBuildTabs(app);
    if (action === 'select' || action === 'close' || action === 'duplicate')
      strip
        .querySelector<HTMLButtonElement>(
          action === 'select' ? 'button[aria-pressed="true"]' : '.build-tab.is-active .build-tab-menu-trigger'
        )
        ?.focus({ preventScroll: true });
  });
  renderBuildTabs(app);
  // Keep the selected tab visible when resizing reduces the space left by the toolbar actions.
  const list = strip.querySelector<HTMLElement>('.build-tab-list')!;
  new ResizeObserver(() => scrollActiveBuildIntoView(list)).observe(list);
}

/** Names are escaped and tab overflow stays inside the strip, including narrow screens. */
export function renderBuildTabs(app: ProfessionAppState): void {
  if (!app.workspace || typeof document === 'undefined') return;
  const strip = document.getElementById('build-workspace-tabs');
  const workspace = app.workspace;
  if (!strip || !workspace) return;
  const list = strip.querySelector<HTMLElement>('.build-tab-list')!;
  const scrollLeft = list.scrollLeft;
  list.innerHTML = workspace.tabs
    .map((tab) => {
      const selected = tab.id === workspace.activeTabId;
      const name = escapeHtml(tab.name);
      const id = escapeHtml(tab.id);
      return `<div class="build-tab${selected ? ' is-active' : ''}">
          <button type="button" data-build-tab-action="select" data-build-tab-id="${id}" aria-pressed="${selected}" title="${name}">${name}</button>
          <button type="button" class="build-tab-menu-trigger" popovertarget="build-tab-menu" data-build-tab-id="${id}" aria-label="Options for ${name}" title="Options for ${name}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
        </div>`;
    })
    .join('');
  const notice = strip.querySelector<HTMLElement>('.build-tab-notice')!;
  notice.textContent = workspace.storageError || '';
  notice.hidden = !workspace.storageError;
  list.scrollLeft = scrollLeft;
  scrollActiveBuildIntoView(list);
}

/** Resizing should reveal the selected tab without replacing focused controls. */
function scrollActiveBuildIntoView(list: HTMLElement): void {
  const selected = list.querySelector<HTMLElement>('.is-active');
  if (selected) {
    const bounds = selected.getBoundingClientRect();
    const visible = list.getBoundingClientRect();
    if (bounds.left < visible.left) list.scrollLeft -= visible.left - bounds.left;
    else if (bounds.right > visible.right) list.scrollLeft += bounds.right - visible.right;
  }
}
