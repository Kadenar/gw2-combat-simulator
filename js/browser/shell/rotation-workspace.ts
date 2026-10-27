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
    const scrollingElement = controller.document.scrollingElement;
    controller.focusScrollPosition = {
      left: view?.scrollX ?? scrollingElement?.scrollLeft ?? 0,
      top: view?.scrollY ?? scrollingElement?.scrollTop ?? 0
    };
  }

  controller.state = state;

  const body = controller.document.body;
  body.toggleAttribute('data-rotation-focus', state.focus);

  controller.focusButton.setAttribute('aria-pressed', String(state.focus));
  controller.focusButton.textContent = state.focus ? 'Exit focus' : 'Focus';

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
  timeline.after(summary);
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

  const controller: RotationWorkspaceController = {
    document,
    focusButton,
    rotationSection,
    state: DEFAULT_ROTATION_WORKSPACE_STATE
  };
  controllers.set(document, controller);
  applyWorkspaceState(controller, controller.state);

  focusButton.addEventListener('click', () => {
    applyWorkspaceState(controller, toggleRotationFocusState(controller.state));
  });
}
