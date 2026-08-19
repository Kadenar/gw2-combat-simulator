/**
 * Registry-driven profession navigation for the landing page and simulator
 * headers.
 *
 * Binding renders an optional landing-page card grid, rebuilds an optional
 * profession select, applies the active profession's theme, and navigates on
 * selection changes. Importing this module in a browser binds the current
 * document automatically; importing it outside a browser has no side effect.
 */

import { embedRoute, isEmbedded } from '../embed.js';
import { mountGw2IconFallback } from '../../platform/ui/gw2-icon-fallback.js';
import { mountRotationTimelineSize } from '../../platform/ui/rotation-timeline-size.js';
import { mountRotationWorkspace } from '../../platform/ui/rotation-workspace.js';
import { mountSimulatorTutorial } from '../tutorial.js';
import { mountSimulatorNavigation } from './navigation.js';
import {
  getProfessionEntry,
  professionGroups,
  type ProfessionRegistryEntry,
  PROFESSION_ROUTES,
  professionRoute
} from './registry.js';

export {
  // Kept here as compatibility exports for existing selector consumers.
  PROFESSION_ROUTES,
  professionRoute
};

const GITHUB_ISSUES_URL = 'https://github.com/Kadenar/gw2-combat-simulator/issues';
const BUILD_SUBMISSION_URL = 'https://github.com/Kadenar/gw2-combat-simulator/issues/new?template=build-submission.yml';

const GITHUB_MARK_SVG =
  '<svg class="github-link-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>';

const LEGAL_TEXT =
  'Guild Wars Games © ArenaNet LLC. All rights reserved. NCSOFT, ArenaNet, Guild Wars, Guild Wars 2, GW2, Heart of Thorns, Path of Fire, End of Dragons, Secrets of the Obscure, Janthir Wilds, Visions of Eternity, and all associated logos, designs, and composite marks are trademarks or registered trademarks of NCSOFT Corporation. All other trademarks are the property of their respective owners.';

/**
 * Adds the community submission actions to the simulator header.
 * Only runs on profession pages; skipped on the landing page.
 * Idempotent so repeat binds don't stack.
 */
function mountCommunityActions(root: Document): void {
  if (!root.body?.dataset.profession) return;
  const host = root.querySelector('header');
  if (!host || host.querySelector('.community-actions')) {
    return;
  }

  const actions = root.createElement('div');
  actions.className = 'community-actions';
  const submissionLink = root.createElement('a');
  submissionLink.className = 'community-link build-submission-link';
  submissionLink.href = BUILD_SUBMISSION_URL;
  submissionLink.target = '_blank';
  submissionLink.rel = 'noopener noreferrer';
  submissionLink.title = 'Submit a build for review on GitHub';
  submissionLink.setAttribute('aria-label', 'Submit a build for review on GitHub');
  submissionLink.innerHTML = '<span aria-hidden="true">+</span><span>Submit a build</span>';
  const link = root.createElement('a');
  link.className = 'community-link github-link';
  link.href = GITHUB_ISSUES_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.title = 'Report an issue on GitHub';
  link.setAttribute('aria-label', 'Report an issue on GitHub');
  link.innerHTML = `${GITHUB_MARK_SVG}<span>Report an issue</span>`;
  actions.append(submissionLink, link);
  host.append(actions);
}

function mountLegalFooter(root: Document): void {
  if (root.querySelector('.landing-footer')) return;
  const app = root.getElementById('app');
  if (!app) return;
  const footer = root.createElement('footer');
  footer.className = 'landing-footer';
  const p = root.createElement('p');
  p.textContent = LEGAL_TEXT;
  footer.append(p);
  // Insert after #app (not inside it) so dynamic layout restructuring in
  // mountBuildTemplateLayout cannot pull the footer up above the workspace.
  app.after(footer);
}

/**
 * Keeps the simulator snapshot badge with the sticky header and publishes the
 * rendered header height for other sticky page controls.
 */
function mountStickyProfessionHeader(root: Document): void {
  if (!root.body?.dataset.profession) return;

  const header = root.querySelector<HTMLElement>('#app > header');
  const appRoot = header?.parentElement;
  if (!header || !appRoot) return;

  const existingSnapshot = header.querySelector<HTMLElement>('.update-info');
  const adjacentSnapshot = header.nextElementSibling;
  const snapshot =
    existingSnapshot ||
    (adjacentSnapshot instanceof HTMLElement && adjacentSnapshot.classList.contains('update-info')
      ? adjacentSnapshot
      : null);
  // The snapshot may already live nested inside the header (e.g. in the
  // top-left brand block); only pull it in when it sits outside the header.
  if (snapshot && !header.contains(snapshot)) header.append(snapshot);

  const updateHeaderHeight = () => {
    appRoot.style.setProperty('--profession-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
  };

  updateHeaderHeight();
  if (header.dataset.stickyHeaderMounted === 'true') return;
  header.dataset.stickyHeaderMounted = 'true';

  const ResizeObserverConstructor = root.defaultView?.ResizeObserver;
  if (ResizeObserverConstructor) {
    new ResizeObserverConstructor(updateHeaderHeight).observe(header);
  } else {
    root.defaultView?.addEventListener('resize', updateHeaderHeight);
  }
}

function activeProfessionId(root: Document, select: HTMLSelectElement): string {
  return root.body?.dataset.profession || select.dataset.activeProfession || '';
}

function populateProfessionSelector(select: HTMLSelectElement, active: string): void {
  const owner = select.ownerDocument || document;
  select.replaceChildren();
  if (!active) {
    const placeholder = owner.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select a simulator…';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.append(placeholder);
  }

  for (const group of professionGroups) {
    const optgroup = owner.createElement('optgroup');
    optgroup.label = group.label;
    for (const entry of group.entries) {
      const option = owner.createElement('option');
      option.value = entry.id;
      option.textContent = entry.name;
      option.selected = entry.id === active;
      optgroup.append(option);
    }

    select.append(optgroup);
  }
}

function renderProfessionCards(root: Document): void {
  const grid = root.querySelector('[data-profession-grid]');
  if (!grid) return;
  grid.replaceChildren();
  for (const group of professionGroups) {
    const heading = root.createElement('h3');
    heading.className = 'profession-group-heading';
    heading.textContent = group.label;
    grid.append(heading);
    renderProfessionGroupCards(root, grid, group.entries);
  }
}

function renderProfessionGroupCards(root: Document, grid: Element, entries: readonly ProfessionRegistryEntry[]): void {
  for (const entry of entries) {
    const card = root.createElement('a');
    card.className = `profession-card profession-card-${entry.id}`;
    const isCurrentProfession = root.body?.dataset.profession === entry.id;
    card.href = isCurrentProfession ? '#workspace' : isEmbedded() ? embedRoute(entry.route) : entry.route;
    card.classList.toggle('profession-card-current', isCurrentProfession);

    const mark = root.createElement('span');
    mark.className = 'profession-mark';
    mark.ariaHidden = 'true';
    const fallback = root.createElement('span');
    fallback.className = 'profession-mark-fallback';
    fallback.textContent = entry.name.charAt(0);
    mark.append(fallback);
    if (entry.icon) {
      const icon = root.createElement('img');
      icon.className = 'profession-mark-icon';
      icon.src = entry.icon;
      icon.alt = '';
      icon.loading = 'lazy';
      icon.decoding = 'async';
      icon.addEventListener(
        'load',
        () => {
          fallback.hidden = true;
        },
        { once: true }
      );
      icon.addEventListener('error', () => icon.remove(), { once: true });
      mark.append(icon);
    }

    const copy = root.createElement('span');
    copy.className = 'profession-card-copy';
    const name = root.createElement('strong');
    name.textContent = entry.name;
    const summary = root.createElement('small');
    summary.textContent = entry.specializationSummary;
    copy.append(name, summary);

    const action = root.createElement('span');
    action.className = 'profession-card-action';
    action.textContent = isCurrentProfession ? 'Return to workspace →' : 'Open simulator →';
    card.append(mark, copy, action);
    grid.append(card);
  }
}

/**
 * Binds profession navigation within a document-like root.
 *
 * The active profession comes from `body[data-profession]`, then from the
 * selector's `data-active-profession`. Missing selector and card-grid elements
 * are allowed so the same entry point can run on landing and simulator pages.
 */
export function bindProfessionSelector(root: Document = document): void {
  mountGw2IconFallback(root);
  mountRotationWorkspace(root);
  mountRotationTimelineSize(root);
  mountLegalFooter(root);
  mountCommunityActions(root);
  mountSimulatorTutorial(root);
  mountSimulatorNavigation(root);
  mountStickyProfessionHeader(root);
  const select = root.getElementById('profession-select') as HTMLSelectElement | null;
  renderProfessionCards(root);
  if (!select) return;

  const active = activeProfessionId(root, select);
  const entry = getProfessionEntry(active);
  if (entry?.themeClass && root.body) {
    root.body.classList.add(entry.themeClass);
  }

  populateProfessionSelector(select, entry?.id || '');

  select.addEventListener('change', () => {
    const route = professionRoute(select.value);
    const current = globalThis.location?.pathname?.split('/').pop() || 'index.html';
    if (current !== route) {
      globalThis.location.assign(isEmbedded() ? embedRoute(route) : route);
    }
  });
}

if (typeof document !== 'undefined') {
  bindProfessionSelector(document);
}
