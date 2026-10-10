import { bindDialog, showDialog } from '#browser/page/dialog.js';
import { mountHeaderDps } from '#browser/shell/header-dps.js';
import { addBuildTab, closeBuildTab, saveBuildWorkspace } from '#gw2/app/build/state/workspace.js';
import { escapeHtml } from '#ui/shared/html.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { clamp } from '#kernel/core/numeric.js';

const CHEVRON_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

/** Give build actions consistent decorative icons while their visible labels remain the accessible names. */
function buildActionIcon(paths: string): string {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

/** Confirm beside the chosen build without closing its menu; narrow viewports keep the popup within reach. */
function confirmBuildClose(app: ProfessionAppState, id: string, trigger: HTMLButtonElement): void {
  const tab = app.workspace?.tabs.find((entry) => entry.id === id);
  if (!tab || app.workspace!.tabs.length < 2) return;
  const menu = trigger.closest<HTMLElement>('#build-switcher-menu')!;
  const list = menu.querySelector<HTMLElement>('.build-tab-list')!;
  const index = [...list.children].indexOf(trigger.closest('.build-tab')!);
  const popup = document.createElement('div');
  popup.id = 'build-close-confirmation';
  popup.className = 'build-close-confirmation';
  popup.popover = 'auto';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-labelledby', 'build-close-title');
  popup.setAttribute('aria-describedby', 'build-close-name build-close-description');
  popup.innerHTML = `<h2 id="build-close-title">Close this build?</h2>
    <p id="build-close-name">${escapeHtml(tab.name)}</p>
    <p id="build-close-description">This removes the build and its rotation from your open builds. This cannot be undone.</p>
    <div class="build-close-actions">
      <button type="button" data-close-cancel autofocus>Cancel</button>
      <button type="button" data-close-confirm>Close build</button>
    </div>`;
  let confirmed = false;
  const position = (): void => {
    const bounds = menu.getBoundingClientRect();
    const row = trigger.getBoundingClientRect();
    const { width, height } = popup.getBoundingClientRect();
    const gap = 8;
    let left = bounds.right + gap;
    let top = row.top;
    if (left + width > innerWidth - gap) {
      if (bounds.left - width - gap >= gap) left = bounds.left - width - gap;
      else {
        left = bounds.left;
        // Stack beside the menu's lower edge when possible; short screens stay near the selected row.
        top = bounds.bottom + gap + height <= innerHeight - gap ? bounds.bottom + gap : row.bottom + gap;
      }
    }

    popup.style.left = `${clamp(left, gap, innerWidth - width - gap)}px`;
    popup.style.top = `${clamp(top, gap, innerHeight - height - gap)}px`;
  };

  popup.addEventListener('click', (event) => {
    // Confirmation controls belong to this popup, not the parent menu's delegated action handler.
    event.stopPropagation();
    const button = (event.target as Element).closest('button');
    if (!button) return;
    confirmed = button.hasAttribute('data-close-confirm');
    popup.hidePopover();
    if (!confirmed) {
      trigger.focus({ preventScroll: true });
      return;
    }

    closeBuildTab(app, id);
    renderBuildTabs(app);
    const row = list.children[Math.min(index, list.children.length - 1)];
    (
      row?.querySelector<HTMLButtonElement>('.build-tab-close:not(:disabled)') ??
      row?.querySelector<HTMLButtonElement>('button')
    )?.focus({ preventScroll: true });
  });
  popup.addEventListener('toggle', () => {
    if (popup.matches(':popover-open')) return;
    window.removeEventListener('resize', position);
    window.removeEventListener('scroll', position, true);
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-controls');
    if (
      !confirmed &&
      menu.matches(':popover-open') &&
      (popup.contains(document.activeElement) || document.activeElement === document.body)
    )
      trigger.focus({ preventScroll: true });
    popup.remove();
  });
  // Nesting native popovers preserves the builds menu and supplies Escape and outside-click cancellation.
  menu.append(popup);
  trigger.setAttribute('aria-expanded', 'true');
  trigger.setAttribute('aria-controls', popup.id);
  popup.showPopover();
  position();
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
}

/** Edits the chosen build in a modal without saving cancelled input. */
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
    document.getElementById('build-switcher')?.focus({ preventScroll: true });
  });
  document.body.append(dialog);
  input.addEventListener('focus', () => input.select(), { once: true });
  showDialog(dialog);
}

/**
 * Keeps one editor mounted behind a single switcher, so the strip stays the same width however many builds are
 * open. File actions stay as explicit buttons beside it instead of collapsing into an overflow menu.
 */
export function mountBuildTabs(app: ProfessionAppState): void {
  if (!app.workspace || document.getElementById('build-workspace-tabs')) return;
  const header = document.querySelector('#app > header');
  if (!header) return;
  const strip = document.createElement('section');
  strip.id = 'build-workspace-tabs';
  strip.className = 'build-workspace-tabs';
  strip.setAttribute('aria-label', 'Builds');
  const library = app.templateContainer ? '' : 'disabled';
  strip.innerHTML = `
    <button type="button" id="build-switcher" class="build-switcher" popovertarget="build-switcher-menu">
      <span class="build-switcher-text">
        <span class="build-switcher-name"></span>
        <span class="build-switcher-count"></span>
      </span>
      ${CHEVRON_ICON}
    </button>
    <div id="build-switcher-menu" class="build-toolbar-menu build-switcher-menu" popover="auto" role="group" aria-label="Open builds">
      <div class="build-menu-heading">Open builds</div>
      <div class="build-tab-list"></div>
      <hr>
      <div class="build-menu-heading">Current build</div>
      <div class="build-switcher-actions">
        <button type="button" data-build-tab-action="save-library" ${library}>${buildActionIcon('<path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-4-6 4Z"/><path d="M9 9h6m-3-3v6"/>')}<span>Save to My Builds…</span></button>
        <button type="button" data-build-tab-action="rename">${buildActionIcon('<path d="m16 3 5 5M3 21l5-1L21 7a3.5 3.5 0 0 0-5-5L3 15l-1 7Z"/>')}<span>Rename</span></button>
        <button type="button" data-build-tab-action="duplicate">${buildActionIcon('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>')}<span>Duplicate</span></button>
        <hr>
        <button type="button" data-build-tab-action="load" ${library}>${buildActionIcon('<path d="M3 8V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v2M3 21h16l3-11H6L3 21ZM3 21 1 8h5"/>')}<span>Load build…</span></button>
        <hr>
      </div>
    </div>
    <div class="build-toolbar-actions">
      <button type="button" class="btn btn-io build-tab-new" popovertarget="build-new-menu">+ New ${CHEVRON_ICON}</button>
    </div>
    <div id="build-new-menu" class="build-toolbar-menu" popover="auto" role="group" aria-label="New build options">
      <button type="button" data-build-tab-action="new">New blank build</button>
      <button type="button" data-build-tab-action="browse" ${library}>Browse templates…</button>
    </div>
    <div class="build-tab-notice" role="status" hidden></div>`;
  // Keep build switching and file actions inside the sticky header in every simulator view.
  header.append(strip);
  mountHeaderDps();
  // Move the bound controls intact so export, import, and reset keep their existing behavior.
  const reset = document.getElementById('btn-reset-build')!;
  // Keep the bound reset control intact, but separate it visually from everyday build edits.
  reset.classList.add('build-action-reset');
  reset.innerHTML = `${buildActionIcon('<path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7"/>')}<span>Reset build</span>`;
  strip.querySelector('.build-switcher-actions')!.append(reset);
  strip
    .querySelector('.build-toolbar-actions')!
    .append(...['btn-export-build', 'btn-import-build'].map((id) => document.getElementById(id)!));
  // Native popovers supply outside-click/Escape dismissal; clamp each dropdown inside the iframe.
  strip.querySelectorAll<HTMLElement>('[popover]').forEach((menu) => {
    menu.addEventListener('toggle', () => {
      if (!menu.matches(':popover-open')) return;
      const bounds = strip.querySelector<HTMLButtonElement>(`[popovertarget="${menu.id}"]`)!.getBoundingClientRect();
      menu.style.left = `${clamp(innerWidth - menu.offsetWidth - 8, 8, bounds.left)}px`;
      menu.style.top = `${clamp(innerHeight - menu.offsetHeight - 8, 8, bounds.bottom + 4)}px`;
      // Open on the current build so keyboard users start from where they are, even in a scrolled list.
      const current = menu.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
      current?.scrollIntoView({ block: 'nearest' });
      (current ?? menu.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus({ preventScroll: true });
    });
  });
  strip.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || !app.workspace || button.hasAttribute('popovertarget')) return;
    const action = button.dataset.buildTabAction;
    // Rows name their own build; the remaining actions always apply to the build being edited.
    const id = button.dataset.buildTabId || app.workspace.activeTabId;
    if (action === 'close') {
      confirmBuildClose(app, id, button);
      return;
    }

    const menu = button.closest<HTMLElement>('[popover]');
    menu?.hidePopover();
    // Triggers are never re-rendered, so dialogs opened from a menu return focus to them on their own.
    if (menu) strip.querySelector<HTMLButtonElement>(`[popovertarget="${menu.id}"]`)!.focus({ preventScroll: true });
    if (!action) return;
    if (action === 'save-library') {
      app.templateContainer?.dispatchEvent(
        new CustomEvent('open-build-save', { detail: document.getElementById('build-switcher') })
      );
      return;
    }

    if (action === 'browse' || action === 'load') {
      if (app.templateContainer) app.templateContainer.dataset.newBuild = String(action === 'browse');
      const dialog = document.querySelector<HTMLDialogElement>('#build-templates-dialog');
      if (dialog) showDialog(dialog);
      return;
    }

    if (action === 'rename') {
      openBuildRenameDialog(app, id);
      return;
    }

    if (action === 'select') app.activateBuildTab?.(id);
    if (action === 'new') addBuildTab(app);
    if (action === 'duplicate') {
      const tab = app.workspace.tabs.find((tab) => tab.id === id)!;
      addBuildTab(app, app.build, `${tab.name} copy`, app.patchId, tab.templateBuild);
    }

    renderBuildTabs(app);
  });
  renderBuildTabs(app);
}

/** Names are escaped; the switcher labels the build being edited and its menu lists every open build. */
export function renderBuildTabs(app: ProfessionAppState): void {
  if (!app.workspace || typeof document === 'undefined') return;
  const strip = document.getElementById('build-workspace-tabs');
  const workspace = app.workspace;
  if (!strip || !workspace) return;
  const count = workspace.tabs.length;
  const active = workspace.tabs.find((tab) => tab.id === workspace.activeTabId);
  // Update the trigger in place so it keeps focus while builds are renamed, loaded, or closed.
  strip.querySelector<HTMLElement>('#build-switcher')!.title = active?.name ?? '';
  strip.querySelector('.build-switcher-name')!.textContent = active?.name ?? '';
  strip.querySelector('.build-switcher-count')!.textContent = `${count} open build${count === 1 ? '' : 's'}`;
  const list = strip.querySelector<HTMLElement>('.build-tab-list')!;
  const scrollTop = list.scrollTop;
  list.innerHTML = workspace.tabs
    .map((tab) => {
      const selected = tab.id === workspace.activeTabId;
      const name = escapeHtml(tab.name);
      const id = escapeHtml(tab.id);
      // The final build always stays open, so its close control is present but unavailable.
      return `<div class="build-tab${selected ? ' is-active' : ''}"><button type="button" data-build-tab-action="select" data-build-tab-id="${id}" aria-pressed="${selected}" title="${name}"><svg class="build-tab-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg><span>${name}</span></button><button type="button" class="build-tab-close" data-build-tab-action="close" data-build-tab-id="${id}" aria-label="Close ${name}" title="Close"${count === 1 ? ' disabled' : ''}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`;
    })
    .join('');
  list.scrollTop = scrollTop;
  const notice = strip.querySelector<HTMLElement>('.build-tab-notice')!;
  notice.textContent = workspace.storageError || '';
  notice.hidden = !workspace.storageError;
}
