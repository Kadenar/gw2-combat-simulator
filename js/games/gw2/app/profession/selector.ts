/**
 * Registry-driven profession navigation for the landing page and simulator
 * headers.
 *
 * Binding renders an optional landing-page card grid, rebuilds an optional
 * profession select, applies the active profession's theme, and navigates on
 * selection changes. Importing this module in a browser binds the current
 * document automatically; importing it outside a browser has no side effect.
 */

import { embedRoute, isEmbedded } from '../../../../app/embed.js';
import { mountGw2IconFallback } from '../presentation/shared/gw2-icon-fallback.js';
import { mountRotationTimelineSize } from '../rotation/timeline/size.js';
import { mountRotationWorkspace } from '../../../../app/shell/workspace.js';
import { mountSimulatorTutorial } from '../tutorial.js';
import { mountSimulatorNavigation } from './navigation.js';
import { professionGroups, type ProfessionRegistryEntry } from './registry.js';

const GITHUB_ISSUES_URL = 'https://github.com/Kadenar/gw2-combat-simulator/issues';
const BUILD_SUBMISSION_URL = 'https://github.com/Kadenar/gw2-combat-simulator/issues/new?template=build-submission.yml';

const GITHUB_MARK_SVG =
  '<svg class="github-link-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>';

const LEGAL_TEXT =
  'Guild Wars Games © ArenaNet LLC. All rights reserved. NCSOFT, ArenaNet, Guild Wars, Guild Wars 2, GW2, Heart of Thorns, Path of Fire, End of Dragons, Secrets of the Obscure, Janthir Wilds, Visions of Eternity, and all associated logos, designs, and composite marks are trademarks or registered trademarks of NCSOFT Corporation. All other trademarks are the property of their respective owners.';

/**
 * Adds the shared build-submission and issue-reporting actions to the main
 * simulator header. Idempotent so repeat binds don't stack.
 */
function mountCommunityActions(root: Document): void {
  const host = root.querySelector('#app > header');
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

/** Publishes the header height and adds its surface only after the page scrolls. */
function mountStickyHeader(root: Document): void {
  const header = root.querySelector<HTMLElement>('#app > header');
  const appRoot = header?.parentElement;
  if (!header || !appRoot) return;

  const updateHeaderHeight = () => {
    appRoot.style.setProperty('--profession-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
  };

  const updateHeaderSurface = () => {
    const scrollTop = root.defaultView?.scrollY ?? root.scrollingElement?.scrollTop ?? 0;
    header.classList.toggle('simulator-header-scrolled', scrollTop > 0);
  };

  updateHeaderHeight();
  updateHeaderSurface();
  if (header.dataset.stickyHeaderMounted === 'true') return;
  header.dataset.stickyHeaderMounted = 'true';

  root.defaultView?.addEventListener('scroll', updateHeaderSurface, { passive: true });
  const ResizeObserverConstructor = root.defaultView?.ResizeObserver;
  if (ResizeObserverConstructor) {
    new ResizeObserverConstructor(updateHeaderHeight).observe(header);
  } else {
    root.defaultView?.addEventListener('resize', updateHeaderHeight);
  }
}

/** Renders every profession in three compact columns so the landing page stays scannable. */
function renderProfessionCards(root: Document): void {
  const grid = root.querySelector('[data-profession-grid]');
  if (!grid) return;
  grid.classList.add('profession-showcase-grid');
  grid.replaceChildren();
  for (const professions of professionGroups) {
    const column = root.createElement('div');
    column.className = 'profession-showcase-group';
    renderProfessionShowcases(root, column, professions);
    grid.append(column);
  }
}

function professionLink(entry: ProfessionRegistryEntry): string {
  return isEmbedded() ? embedRoute(entry.route) : entry.route;
}

/** Shows one random specialization image per profession so each compact card varies between page visits. */
function renderProfessionShowcases(root: Document, grid: Element, entries: readonly ProfessionRegistryEntry[]): void {
  for (const entry of entries) {
    const showcase = root.createElement('article');
    showcase.className = `profession-showcase profession-card-${entry.id}`;

    const header = root.createElement('header');
    header.className = 'profession-showcase-header';
    const name = root.createElement('strong');
    name.className = 'profession-showcase-name';
    name.textContent = entry.name;
    const simulatorLink = root.createElement('a');
    simulatorLink.className = 'profession-showcase-link';
    simulatorLink.href = professionLink(entry);
    simulatorLink.textContent = 'Open simulator →';
    header.append(name, simulatorLink);

    const gallery = root.createElement('div');
    gallery.className = 'specialization-showcase-grid';
    const artwork = entry.specializationArtwork;
    const specialization = artwork?.length ? artwork[Math.floor(Math.random() * artwork.length)] : undefined;
    if (specialization) {
      const card = root.createElement('a');
      card.className = 'specialization-showcase-card';
      card.href = professionLink(entry);
      card.setAttribute('aria-label', `${specialization.name}: open the ${entry.name} simulator`);

      const image = root.createElement('img');
      image.src = specialization.image;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener(
        'error',
        () => {
          image.remove();
          card.classList.add('specialization-showcase-card-placeholder');
        },
        { once: true }
      );

      const copy = root.createElement('span');
      copy.className = 'specialization-showcase-copy';
      const name = root.createElement('strong');
      name.textContent = specialization.name;
      copy.append(name);
      card.append(image, copy);
      gallery.append(card);
    } else {
      const placeholder = root.createElement('a');
      placeholder.className = 'specialization-showcase-card specialization-showcase-card-placeholder';
      placeholder.href = professionLink(entry);
      const copy = root.createElement('span');
      copy.className = 'specialization-showcase-copy';
      const label = root.createElement('strong');
      label.textContent = 'Artwork coming soon';
      const cardAction = root.createElement('small');
      cardAction.textContent = `Open ${entry.name} simulator →`;
      copy.append(label, cardAction);
      placeholder.append(copy);
      gallery.append(placeholder);
    }

    showcase.append(header, gallery);
    grid.append(showcase);
  }
}

/**
 * Binds profession navigation within a document-like root.
 *
 * Mounts the shared simulator chrome and renders the profession card grid when
 * present. A missing card grid is allowed so the same entry point can run on
 * landing and simulator pages.
 */
export function bindProfessionSelector(root: Document = document): void {
  mountGw2IconFallback(root);
  mountLegalFooter(root);
  mountRotationWorkspace(root);
  mountRotationTimelineSize(root);
  mountCommunityActions(root);
  mountSimulatorTutorial(root);
  mountSimulatorNavigation(root);
  mountStickyHeader(root);
  renderProfessionCards(root);
}

if (typeof document !== 'undefined') {
  bindProfessionSelector(document);
}
