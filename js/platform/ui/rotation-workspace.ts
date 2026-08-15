export type RotationWorkspaceAction =
  "toggle-config" | "close-config" | "toggle-focus" | "escape";

export type RotationWorkspaceState = Readonly<{
  configOpen: boolean;
  focus: boolean;
}>;

export const DEFAULT_ROTATION_WORKSPACE_STATE: RotationWorkspaceState =
  Object.freeze({
    configOpen: false,
    focus: false,
  });

type RotationWorkspaceController = {
  builderControls: HTMLElement;
  configButton: HTMLButtonElement;
  configButtonTrack: HTMLElement;
  configCloseButton: HTMLButtonElement;
  configPanel: HTMLElement;
  document: Document;
  focusButton: HTMLButtonElement;
  focusIndicator: HTMLElement;
  panelResizeObserver?: ResizeObserver;
  state: RotationWorkspaceState;
};

const controllers = new WeakMap<Document, RotationWorkspaceController>();

/** Closes transient rotation UI before leaving the workspace view. */
export function resetRotationWorkspace(root: Document = document): void {
  const controller = controllers.get(root);
  if (!controller) return;
  applyWorkspaceState(controller, DEFAULT_ROTATION_WORKSPACE_STATE);
}

export function syncRotationFocusResults(root: Document = document): void {
  const focused = root.body?.hasAttribute("data-rotation-focus") === true;
  for (const details of root.querySelectorAll<HTMLDetailsElement>(
    ".rotation-results .res-breakpoints",
  )) {
    if (focused && !details.open) {
      details.dataset.focusExpanded = "true";
      details.open = true;
    } else if (!focused && details.dataset.focusExpanded === "true") {
      details.open = false;
      delete details.dataset.focusExpanded;
    }
  }
}

export function reduceRotationWorkspaceState(
  state: RotationWorkspaceState,
  action: RotationWorkspaceAction,
): RotationWorkspaceState {
  if (action === "toggle-config") {
    return { ...state, configOpen: !state.configOpen };
  }
  if (action === "close-config") {
    return { ...state, configOpen: false };
  }
  if (action === "toggle-focus") {
    return { configOpen: false, focus: !state.focus };
  }
  if (state.configOpen) {
    return { ...state, configOpen: false };
  }
  return state;
}

function applyWorkspaceState(
  controller: RotationWorkspaceController,
  state: RotationWorkspaceState,
): void {
  controller.state = state;

  const body = controller.document.body;
  body.toggleAttribute("data-simulation-config-open", state.configOpen);
  body.toggleAttribute("data-rotation-focus", state.focus);

  const configButtonHost = state.focus
    ? controller.builderControls
    : controller.configButtonTrack;
  if (controller.configButton.parentElement !== configButtonHost) {
    if (state.focus) {
      configButtonHost.prepend(controller.configButton);
    } else {
      configButtonHost.append(controller.configButton);
    }
  }

  controller.configButton.setAttribute(
    "aria-expanded",
    String(state.configOpen),
  );
  const configButtonLabel = state.configOpen
    ? "Hide Simulation Config"
    : "Open Simulation Config";
  controller.configButton.textContent = "";
  controller.configButton.setAttribute("aria-label", configButtonLabel);
  controller.configButton.title = configButtonLabel;
  controller.configPanel.setAttribute("aria-hidden", String(!state.configOpen));
  controller.configPanel.inert = !state.configOpen;

  controller.focusButton.setAttribute("aria-pressed", String(state.focus));
  controller.focusButton.textContent = state.focus ? "Exit focus" : "Focus";
  controller.focusIndicator.hidden = !state.focus;
  syncRotationFocusResults(controller.document);
}

function dispatchWorkspaceAction(
  controller: RotationWorkspaceController,
  action: RotationWorkspaceAction,
  restoreConfigFocus = false,
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
  configPanelId: string,
): {
  controls: HTMLElement;
  configButton: HTMLButtonElement;
  focusButton: HTMLButtonElement;
  focusIndicator: HTMLElement;
} {
  const titleText = heading.textContent?.trim() || "Rotation Builder";
  const title = root.createElement("span");
  title.className = "rotation-builder-title";
  title.textContent = titleText;

  const focusIndicator = root.createElement("span");
  focusIndicator.className = "rotation-focus-indicator";
  focusIndicator.textContent = "Focus mode";
  focusIndicator.hidden = true;

  const headingTitle = root.createElement("span");
  headingTitle.className = "rotation-builder-heading-title";
  headingTitle.append(title, focusIndicator);

  const controls = root.createElement("span");
  controls.className = "rotation-builder-controls";

  const configButton = root.createElement("button");
  configButton.type = "button";
  configButton.className = "btn btn-io simulation-config-open-button";
  configButton.setAttribute("aria-controls", configPanelId);
  configButton.setAttribute("aria-haspopup", "dialog");
  configButton.title = "Open Simulation Config";

  const focusButton = root.createElement("button");
  focusButton.type = "button";
  focusButton.className = "btn btn-io rotation-focus-toggle";
  focusButton.title = "Maximize the Rotation Builder";

  controls.append(configButton, focusButton);
  heading.replaceChildren(headingTitle, controls);
  heading.classList.add("rotation-builder-heading");

  return { configButton, controls, focusButton, focusIndicator };
}

function mountConfigHeading(
  root: Document,
  heading: HTMLElement,
): HTMLButtonElement {
  const title = root.createElement("span");
  title.className = "simulation-config-title";
  title.textContent = heading.textContent?.trim() || "Simulation Config";

  const button = root.createElement("button");
  button.type = "button";
  button.className = "simulation-config-close-button";
  button.setAttribute("aria-label", "Close Simulation Config");
  button.title = "Close Simulation Config";
  button.textContent = "\u00d7";

  heading.replaceChildren(title, button);
  return button;
}

/** Mounts the config drawer and full-viewport Rotation Builder focus mode. */
export function mountRotationWorkspace(root: Document = document): void {
  if (controllers.has(root)) return;

  const workspace = root.querySelector<HTMLElement>(".simulation-workspace");
  const rotationHeading = workspace?.querySelector<HTMLElement>(
    ".rotation-panel > h3",
  );
  const rotationPanel =
    rotationHeading?.closest<HTMLElement>(".rotation-panel");
  const rotationSection =
    rotationPanel?.closest<HTMLElement>(".rotation-section");
  const configPanel = workspace?.querySelector<HTMLElement>(".perma-section");
  const configHeading =
    configPanel?.querySelector<HTMLElement>(".perma-panel > h3");
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

  const panelShell = root.createElement("div");
  panelShell.className = "rotation-panel-shell";
  rotationPanel.before(panelShell);
  panelShell.append(rotationPanel);
  rotationSection.append(configPanel);

  const syncRotationPanelHeight = (): void => {
    rotationSection.style.setProperty(
      "--rotation-panel-height",
      `${rotationPanel.offsetHeight}px`,
    );
  };
  syncRotationPanelHeight();
  const ResizeObserverConstructor = root.defaultView?.ResizeObserver;
  const panelResizeObserver = ResizeObserverConstructor
    ? new ResizeObserverConstructor(syncRotationPanelHeight)
    : undefined;
  panelResizeObserver?.observe(rotationPanel);

  configPanel.id ||= "simulation-config-panel";
  configPanel.setAttribute("role", "dialog");
  configPanel.setAttribute("aria-labelledby", "simulation-config-title");

  const configCloseButton = mountConfigHeading(root, configHeading);
  configHeading.querySelector(".simulation-config-title")!.id =
    "simulation-config-title";
  const { configButton, controls, focusButton, focusIndicator } =
    mountRotationHeading(root, rotationHeading, configPanel.id);

  const configButtonTrack = root.createElement("div");
  configButtonTrack.className = "simulation-config-button-track";
  rotationSection.append(configButtonTrack);

  const controller: RotationWorkspaceController = {
    builderControls: controls,
    configButton,
    configButtonTrack,
    configCloseButton,
    configPanel,
    document: root,
    focusButton,
    focusIndicator,
    panelResizeObserver,
    state: DEFAULT_ROTATION_WORKSPACE_STATE,
  };
  controllers.set(root, controller);
  applyWorkspaceState(controller, controller.state);

  configButton.addEventListener("click", () =>
    dispatchWorkspaceAction(controller, "toggle-config", true),
  );
  configCloseButton.addEventListener("click", () =>
    dispatchWorkspaceAction(controller, "close-config", true),
  );
  focusButton.addEventListener("click", () =>
    dispatchWorkspaceAction(controller, "toggle-focus"),
  );
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (root.querySelector("dialog[open]")) return;
    const next = reduceRotationWorkspaceState(controller.state, "escape");
    if (next === controller.state) return;
    event.preventDefault();
    const restoreConfigFocus = controller.state.configOpen;
    applyWorkspaceState(controller, next);
    if (restoreConfigFocus) controller.configButton.focus();
  });
}
