/** Owns the simulator page's rotation workspace layout, focus mode, and live DPS chrome. */
export type RotationWorkspaceAction = 'toggle-config' | 'close-config' | 'toggle-focus' | 'escape';

export type RotationWorkspaceState = Readonly<{
  configOpen: boolean;
  focus: boolean;
}>;

export const DEFAULT_ROTATION_WORKSPACE_STATE: RotationWorkspaceState = Object.freeze({
  configOpen: false,
  focus: false
});

type RotationWorkspaceController = {
  configButton: HTMLButtonElement;
  configCloseButton: HTMLButtonElement;
  configPanel: HTMLElement;
  document: Document;
  focusButton: HTMLButtonElement;
  focusIndicator: HTMLElement;
  focusScrollPosition?: Readonly<{ left: number; top: number }>;
  state: RotationWorkspaceState;
};

const controllers = new WeakMap<Document, RotationWorkspaceController>();
const FLOATING_DPS_PLACEHOLDER = '\u2014';
export const ROTATION_FOCUS_EXIT_EVENT = 'rotation-workspace-focus-exit';

/** Mounts the current rotation DPS as a viewport-pinned status that survives page scrolling and view changes. */
export function mountFloatingDps(root: Document = document): HTMLOutputElement | null {
  const existing = root.getElementById('floating-dps');
  if (existing) return existing as HTMLOutputElement;
  if (!root.body || !root.querySelector('.simulation-workspace')) return null;

  const indicator = root.createElement('output');
  indicator.id = 'floating-dps';
  indicator.className = 'floating-dps';
  indicator.setAttribute('aria-live', 'polite');
  indicator.setAttribute('aria-label', 'Current rotation DPS unavailable');

  const label = root.createElement('span');
  label.className = 'floating-dps-label';
  label.textContent = 'DPS';

  const value = root.createElement('strong');
  value.className = 'floating-dps-value';
  value.textContent = FLOATING_DPS_PLACEHOLDER;

  indicator.append(label, value);
  // Anchoring to the fixed legal footer keeps the badge above its real rendered height at every viewport width.
  const footer = root.documentElement?.classList.contains('embed')
    ? null
    : root.querySelector<HTMLElement>('.landing-footer');
  if (!footer) indicator.className += ' floating-dps-viewport';
  const host = footer || root.body;
  host.append(indicator);
  return indicator;
}

/** Keeps the pinned status synchronized with the latest formatted simulation result. */
export function updateFloatingDps(value: string | null | undefined, root: Document = document): void {
  const indicator = root.getElementById('floating-dps');
  const valueElement = indicator?.querySelector<HTMLElement>('.floating-dps-value');
  if (!indicator || !valueElement) return;

  const displayValue = value?.trim() || FLOATING_DPS_PLACEHOLDER;
  valueElement.textContent = displayValue;
  indicator.setAttribute(
    'aria-label',
    displayValue === FLOATING_DPS_PLACEHOLDER
      ? 'Current rotation DPS unavailable'
      : `Current rotation DPS: ${displayValue}`
  );
}

/** Closes transient rotation UI before leaving the workspace view. */
export function resetRotationWorkspace(root: Document = document): void {
  const controller = controllers.get(root);
  if (!controller) return;
  applyWorkspaceState(controller, DEFAULT_ROTATION_WORKSPACE_STATE);
}

/** Enters the existing full-screen rotation workspace without coupling callers to its button markup. */
export function enterRotationFocus(root: Document = document): void {
  const controller = controllers.get(root);
  if (!controller || controller.state.focus) return;
  applyWorkspaceState(controller, { configOpen: false, focus: true });
}

export function reduceRotationWorkspaceState(
  state: RotationWorkspaceState,
  action: RotationWorkspaceAction
): RotationWorkspaceState {
  if (action === 'toggle-config') {
    return { ...state, configOpen: !state.configOpen };
  }

  if (action === 'close-config') {
    return { ...state, configOpen: false };
  }

  if (action === 'toggle-focus') {
    return { configOpen: false, focus: !state.focus };
  }

  if (state.configOpen) {
    return { ...state, configOpen: false };
  }

  return state;
}

export function isSimulationConfigVisible(state: RotationWorkspaceState): boolean {
  return state.configOpen;
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
  body.toggleAttribute('data-simulation-config-open', state.configOpen);
  body.toggleAttribute('data-rotation-focus', state.focus);

  controller.configButton.setAttribute('aria-expanded', String(state.configOpen));
  const configButtonLabel = state.configOpen ? 'Hide simulation config' : 'Open simulation config';
  // Keep the settings action visibly labeled while its accessible hint reflects the drawer state.
  controller.configButton.textContent = 'Settings';
  controller.configButton.setAttribute('aria-label', configButtonLabel);
  controller.configButton.title = configButtonLabel;
  const configVisible = isSimulationConfigVisible(state);
  controller.configPanel.setAttribute('aria-hidden', String(!configVisible));
  controller.configPanel.inert = !configVisible;
  controller.configPanel.setAttribute('role', 'dialog');
  controller.configPanel.toggleAttribute('aria-modal', state.configOpen);

  controller.focusButton.setAttribute('aria-pressed', String(state.focus));
  controller.focusButton.textContent = state.focus ? 'Exit focus' : 'Focus';
  controller.focusIndicator.hidden = !state.focus;

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

function dispatchWorkspaceAction(
  controller: RotationWorkspaceController,
  action: RotationWorkspaceAction,
  restoreConfigFocus = false
): void {
  const previous = controller.state;
  const next = reduceRotationWorkspaceState(previous, action);
  if (next === previous) return;
  applyWorkspaceState(controller, next);

  if (!previous.configOpen && next.configOpen) {
    controller.configCloseButton.focus();
  } else if (previous.configOpen && !next.configOpen && restoreConfigFocus) {
    controller.configButton.focus();
  }
}

function mountRotationHeading(
  root: Document,
  heading: HTMLElement,
  configPanelId: string
): {
  configButton: HTMLButtonElement;
  focusButton: HTMLButtonElement;
  focusIndicator: HTMLElement;
} {
  const titleText =
    heading.querySelector('.rotation-builder-title')?.textContent?.trim() ||
    heading.textContent?.trim() ||
    'Rotation builder';
  const hint = heading.querySelector<HTMLElement>('.palette-hint');
  const title = root.createElement('span');
  title.className = 'rotation-builder-title';
  title.textContent = titleText;

  const focusIndicator = root.createElement('span');
  focusIndicator.className = 'rotation-focus-indicator';
  focusIndicator.textContent = 'Focus mode';
  focusIndicator.hidden = true;

  const headingTitle = root.createElement('span');
  headingTitle.className = 'rotation-builder-heading-title';
  headingTitle.append(title, focusIndicator);
  // Keep the compact interaction guide beside the title instead of consuming a separate builder row.
  if (hint) headingTitle.append(hint);

  const controls = root.createElement('span');
  controls.className = 'rotation-builder-controls';

  const configButton = root.createElement('button');
  configButton.type = 'button';
  configButton.className = 'btn btn-io simulation-config-open-button';
  configButton.setAttribute('aria-controls', configPanelId);
  configButton.setAttribute('aria-haspopup', 'dialog');
  configButton.title = 'Open simulation config';

  const focusButton = root.createElement('button');
  focusButton.type = 'button';
  focusButton.className = 'btn btn-io rotation-focus-toggle';
  focusButton.title = 'Maximize the rotation builder';

  controls.append(focusButton, configButton);
  heading.replaceChildren(headingTitle, controls);
  heading.classList.add('rotation-builder-heading');

  return { configButton, focusButton, focusIndicator };
}

function mountConfigHeading(root: Document, heading: HTMLElement): HTMLButtonElement {
  const title = root.createElement('span');
  title.className = 'simulation-config-title';
  title.textContent = heading.textContent?.trim() || 'Simulation config';

  const button = root.createElement('button');
  button.type = 'button';
  button.className = 'simulation-config-close-button';
  button.setAttribute('aria-label', 'Close simulation config');
  button.title = 'Close simulation config';
  button.textContent = '\u00d7';

  heading.replaceChildren(title, button);
  return button;
}

/** Adds the live DPS strip to the builder flow immediately below its timeline. */
export function mountRotationDpsSummary(root: Document, rotationPanel: HTMLElement): void {
  if (root.getElementById('rotation-dps-summary')) return;
  const timeline = rotationPanel.querySelector<HTMLElement>('#rotation-timeline');
  if (!timeline) return;

  const summary = root.createElement('div');
  summary.id = 'rotation-dps-summary';
  summary.className = 'rotation-dps-summary';
  timeline.after(summary);
}

/** Mounts the anchored config panel and full-viewport Rotation Builder mode. */
export function mountRotationWorkspace(root: Document = document): void {
  if (controllers.has(root)) return;

  const workspace = root.querySelector<HTMLElement>('.simulation-workspace');
  const rotationHeading = workspace?.querySelector<HTMLElement>('.rotation-panel > h3');
  const rotationPanel = rotationHeading?.closest<HTMLElement>('.rotation-panel');
  const rotationSection = rotationPanel?.closest<HTMLElement>('.rotation-section');
  const configPanel = workspace?.querySelector<HTMLElement>('.perma-section');
  const configHeading = configPanel?.querySelector<HTMLElement>('.perma-panel > h3');
  if (
    !root.body ||
    !workspace ||
    !rotationHeading ||
    !rotationPanel ||
    !rotationSection ||
    !configPanel ||
    !configHeading
  ) {
    return;
  }

  const panelShell = root.createElement('div');
  panelShell.className = 'rotation-panel-shell';
  rotationPanel.before(panelShell);
  panelShell.append(rotationPanel);
  mountRotationDpsSummary(root, rotationPanel);
  mountFloatingDps(root);

  configPanel.id ||= 'simulation-config-panel';
  configPanel.setAttribute('aria-labelledby', 'simulation-config-title');

  const configCloseButton = mountConfigHeading(root, configHeading);
  configHeading.querySelector('.simulation-config-title')!.id = 'simulation-config-title';
  const { configButton, focusButton, focusIndicator } = mountRotationHeading(root, rotationHeading, configPanel.id);

  const controller: RotationWorkspaceController = {
    configButton,
    configCloseButton,
    configPanel,
    document: root,
    focusButton,
    focusIndicator,
    state: DEFAULT_ROTATION_WORKSPACE_STATE
  };
  controllers.set(root, controller);
  applyWorkspaceState(controller, controller.state);

  configButton.addEventListener('click', () => dispatchWorkspaceAction(controller, 'toggle-config', true));
  configCloseButton.addEventListener('click', () => dispatchWorkspaceAction(controller, 'close-config', true));
  focusButton.addEventListener('click', () => dispatchWorkspaceAction(controller, 'toggle-focus'));
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (root.querySelector('dialog[open]')) return;
    const next = reduceRotationWorkspaceState(controller.state, 'escape');
    if (next === controller.state) return;
    event.preventDefault();
    const restoreConfigFocus = controller.state.configOpen;
    applyWorkspaceState(controller, next);
    if (restoreConfigFocus) controller.configButton.focus();
  });
}
