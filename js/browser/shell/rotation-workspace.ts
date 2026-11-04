/** Owns the simulator page's rotation workspace layout, focus mode, and live DPS strip. */
import { trackEmbeddedViewport } from '#browser/page/embed.js';

export type RotationWorkspaceState = Readonly<{
  focus: boolean;
}>;

export const DEFAULT_ROTATION_WORKSPACE_STATE: RotationWorkspaceState = Object.freeze({
  focus: false
});

type RotationWorkspaceController = {
  document: Document;
  focusButton: HTMLButtonElement;
  rotationSection: HTMLElement;
  focusLauncher?: HTMLElement;
  inertBackground: Map<HTMLElement, boolean>;
  stopFocusViewport?: () => void;
  focusScrollPosition?: Readonly<{ left: number; top: number }>;
  state: RotationWorkspaceState;
};

const controllers = new WeakMap<Document, RotationWorkspaceController>();

export const ROTATION_FOCUS_EXIT_EVENT = 'rotation-workspace-focus-exit';

/** Closes transient rotation UI before leaving the workspace view. */
export function resetRotationWorkspace(root: Document = document): void {
  const controller = controllers.get(root);

  if (!controller) return;

  applyWorkspaceState(controller, DEFAULT_ROTATION_WORKSPACE_STATE);
}

/** Enters the existing full-screen rotation workspace without coupling callers to its button markup. */
export function enterRotationFocus(): void {
  const controller = controllers.get(document);

  if (!controller || controller.state.focus) return;

  applyWorkspaceState(controller, { focus: true });
}

/** Toggle workspace focus independently of the native settings disclosure. */
export function toggleRotationFocusState(state: RotationWorkspaceState): RotationWorkspaceState {
  return { focus: !state.focus };
}

function applyWorkspaceState(controller: RotationWorkspaceController, state: RotationWorkspaceState): void {
  const previous = controller.state;
  const view = controller.document.defaultView;

  if (!previous.focus && state.focus) {
    const active = controller.document.activeElement;
    controller.focusLauncher =
      active instanceof HTMLElement && active !== controller.document.body ? active : undefined;
    const scrollingElement = controller.document.scrollingElement;
    controller.focusScrollPosition = {
      left: view?.scrollX ?? scrollingElement?.scrollLeft ?? 0,
      top: view?.scrollY ?? scrollingElement?.scrollTop ?? 0
    };
  }

  controller.state = state;

  const body = controller.document.body;
  body.toggleAttribute('data-rotation-focus', state.focus);

  // The header is inert in Focus view; use a dedicated DPS status without reading every summary metric.
  controller.document.getElementById('rotation-dps-status')?.setAttribute('aria-live', state.focus ? 'polite' : 'off');

  controller.focusButton.setAttribute('aria-pressed', String(state.focus));
  controller.focusButton.textContent = state.focus ? 'Exit focus' : 'Focus';
  controller.focusButton.title = state.focus ? 'Return to your build workspace' : 'Maximize the rotation builder';

  // Remove hidden background controls from keyboard navigation while keeping top-layer rotation editors usable.
  if (!previous.focus && state.focus) {
    let branch: HTMLElement = controller.rotationSection;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (
          !(sibling instanceof HTMLElement) ||
          sibling === branch ||
          sibling.matches('dialog, [popover], script, style')
        )
          continue;

        controller.inertBackground.set(sibling, sibling.inert);
        sibling.inert = true;
      }

      branch = branch.parentElement;

      if (branch === body) break;
    }

    controller.focusButton.focus({ preventScroll: true });
  } else if (previous.focus && !state.focus) {
    for (const [element, inert] of controller.inertBackground) element.inert = inert;
    controller.inertBackground.clear();
    const launcher = controller.focusLauncher;
    controller.focusLauncher = undefined;

    if (launcher?.isConnected && launcher.getClientRects().length) launcher.focus({ preventScroll: true });
  }

  // Place focus where the host is already scrolled instead of jumping to the top of a tall iframe.
  if (previous.focus !== state.focus && controller.document.documentElement.classList.contains('embed')) {
    controller.stopFocusViewport?.();
    controller.stopFocusViewport = state.focus
      ? trackEmbeddedViewport(controller.rotationSection, { preserveHeight: true })
      : undefined;
  }

  if (previous.focus && !state.focus && controller.focusScrollPosition) {
    const { left, top } = controller.focusScrollPosition;
    controller.focusScrollPosition = undefined;
    view?.scrollTo(left, top);
  }

  // Focus-owned features use this boundary to discard layouts that cannot remain active outside focus mode.
  if (previous.focus && !state.focus) {
    controller.document.dispatchEvent(new Event(ROTATION_FOCUS_EXIT_EVENT));
  }
}

function mountRotationHeading(root: Document, heading: HTMLElement): HTMLButtonElement {
  const titleText =
    heading.querySelector('.rotation-builder-title')?.textContent?.trim() ||
    heading.textContent?.trim() ||
    'Rotation builder';
  const hint = heading.querySelector<HTMLElement>('.palette-hint');
  const title = root.createElement('span');
  title.className = 'rotation-builder-title';
  title.textContent = titleText;

  // Reserve a quiet status line under the title so palette refreshes never cover skills or move controls.
  const paletteStatus = root.createElement('span');
  paletteStatus.className = 'palette-update-status';
  paletteStatus.dataset.paletteUpdateStatus = '';
  paletteStatus.setAttribute('role', 'status');
  paletteStatus.hidden = true;
  const label = root.createElement('span');
  label.className = 'rotation-builder-label';
  label.append(title, paletteStatus);

  const headingTitle = root.createElement('span');
  headingTitle.className = 'rotation-builder-heading-title';
  headingTitle.append(label);

  // Keep the compact interaction guide beside the title instead of consuming a separate builder row.
  if (hint) headingTitle.append(hint);

  const controls = root.createElement('span');
  controls.className = 'rotation-builder-controls';

  const focusButton = root.createElement('button');
  focusButton.type = 'button';
  focusButton.className = 'btn btn-io rotation-focus-toggle';
  focusButton.title = 'Maximize the rotation builder';

  controls.append(focusButton);
  heading.replaceChildren(headingTitle, controls);
  heading.classList.add('rotation-builder-heading');

  return focusButton;
}

/** Adds the live DPS strip between the timeline and its expandable analysis panels. */
export function mountRotationDpsSummary(root: Document, rotationPanel: HTMLElement): void {
  if (root.getElementById('rotation-dps-summary')) return;

  const timeline = rotationPanel.querySelector<HTMLElement>('#rotation-timeline');

  if (!timeline) return;

  const summary = root.createElement('div');
  summary.id = 'rotation-dps-summary';
  summary.className = 'rotation-dps-summary';
  const status = root.createElement('output');
  status.id = 'rotation-dps-status';
  status.className = 'rotation-dps-status';
  status.setAttribute('aria-live', 'off');
  status.setAttribute('aria-atomic', 'true');
  timeline.after(summary, status);
}

/** Mounts the rotation builder while native inline settings remain available in normal and focus modes. */
export function mountRotationWorkspace(): void {
  if (controllers.has(document)) return;

  const workspace = document.querySelector<HTMLElement>('.simulation-workspace');
  const rotationHeading = workspace?.querySelector<HTMLElement>('.rotation-panel > h3');
  const rotationPanel = rotationHeading?.closest<HTMLElement>('.rotation-panel');
  const rotationSection = rotationPanel?.closest<HTMLElement>('.rotation-section');

  if (!document.body || !workspace || !rotationHeading || !rotationPanel || !rotationSection) return;

  const panelShell = document.createElement('div');
  panelShell.className = 'rotation-panel-shell';
  rotationPanel.before(panelShell);
  panelShell.append(rotationPanel);
  mountRotationDpsSummary(document, rotationPanel);

  const focusButton = mountRotationHeading(document, rotationHeading);

  // Phones collapse occasional toolbar settings; desktop always exposes them after a breakpoint change.
  const options = rotationPanel.querySelector<HTMLDetailsElement>('.rotation-options');
  const mobileToolbar = window.matchMedia('(max-width: 700px)');
  const syncToolbarOptions = (): void => {
    if (options) options.open = !mobileToolbar.matches;
  };

  syncToolbarOptions();
  mobileToolbar.addEventListener('change', syncToolbarOptions);

  const controller: RotationWorkspaceController = {
    document,
    focusButton,
    rotationSection,
    inertBackground: new Map(),
    state: DEFAULT_ROTATION_WORKSPACE_STATE
  };
  controllers.set(document, controller);
  applyWorkspaceState(controller, controller.state);

  focusButton.addEventListener('click', () => {
    applyWorkspaceState(controller, toggleRotationFocusState(controller.state));
  });

  // Escape dismisses transient edits; an active comparison ends only through its explicit exit controls.
  document.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key !== 'Escape' ||
        !controller.state.focus ||
        document.body.hasAttribute('data-rotation-comparison') ||
        document.querySelector('dialog[open], :popover-open, .rotation-hotkeys-active')
      )
        return;

      document.defaultView?.setTimeout(() => {
        if (
          !event.defaultPrevented &&
          controller.state.focus &&
          !document.body.hasAttribute('data-rotation-comparison')
        )
          applyWorkspaceState(controller, DEFAULT_ROTATION_WORKSPACE_STATE);
      }, 0);
    },
    { capture: true }
  );
}
