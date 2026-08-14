export const SIMULATION_CONFIG_COLLAPSED_STORAGE_KEY =
  "gw2-simulation-config-collapsed";

export function normalizeSimulationConfigCollapsed(value: unknown): boolean {
  return value === true || value === "true";
}

function readStoredState(root: Document): boolean {
  try {
    return normalizeSimulationConfigCollapsed(
      root.defaultView?.localStorage.getItem(
        SIMULATION_CONFIG_COLLAPSED_STORAGE_KEY,
      ),
    );
  } catch {
    return false;
  }
}

function storeState(root: Document, collapsed: boolean): void {
  try {
    root.defaultView?.localStorage.setItem(
      SIMULATION_CONFIG_COLLAPSED_STORAGE_KEY,
      String(collapsed),
    );
  } catch {
    // Browser storage may be unavailable in private or embedded contexts.
  }
}

/** Adds the workspace control that gives the rotation builder the config width. */
export function mountSimulationConfigCollapse(root: Document = document): void {
  const workspace = root.querySelector<HTMLElement>(".simulation-workspace");
  const panel = workspace?.querySelector<HTMLElement>(".perma-panel");
  const content = panel?.querySelector<HTMLElement>("#perma-boons");
  const heading = panel?.querySelector<HTMLElement>("h3");
  if (!workspace || !content || !heading) return;

  let title = heading.querySelector<HTMLElement>(".simulation-config-title");
  if (!title) {
    title = root.createElement("span");
    title.className = "simulation-config-title";
    title.textContent = heading.textContent?.trim() || "Simulation Config";
    heading.replaceChildren(title);
  }

  let button = heading.querySelector<HTMLButtonElement>(
    ".simulation-config-toggle",
  );
  if (!button) {
    button = root.createElement("button");
    button.type = "button";
    button.className = "simulation-config-toggle";
    button.setAttribute("aria-controls", content.id);
    heading.append(button);
  }

  const setCollapsed = (collapsed: boolean): void => {
    workspace.dataset.configCollapsed = String(collapsed);
    content.hidden = collapsed;
    button.setAttribute("aria-expanded", String(!collapsed));
    button.setAttribute(
      "aria-label",
      `${collapsed ? "Expand" : "Collapse"} Simulation Config`,
    );
    button.title = `${collapsed ? "Expand" : "Collapse"} Simulation Config`;
    button.textContent = collapsed ? "+" : "\u2212";
  };

  setCollapsed(readStoredState(root));
  button.addEventListener("click", () => {
    const collapsed = workspace.dataset.configCollapsed !== "true";
    setCollapsed(collapsed);
    storeState(root, collapsed);
  });
}
