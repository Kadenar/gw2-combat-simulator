import { resetRotationWorkspace } from "../../platform/ui/rotation-workspace.js";
import { embedRoute, isEmbedded } from "../embed.js";

export type SimulatorView = "professions" | "workspace" | "analysis";

const VIEW_HASHES: Readonly<Record<SimulatorView, string>> = {
  professions: "#professions",
  workspace: "#workspace",
  analysis: "#analysis",
};

export function simulatorViewFromHash(hash: string): SimulatorView {
  const normalized = hash.toLowerCase();
  if (normalized === VIEW_HASHES.professions) return "professions";
  if (normalized === VIEW_HASHES.analysis) return "analysis";
  return "workspace";
}

export function simulatorViewHref(
  pathname: string,
  view: SimulatorView,
): string {
  const route = pathname.split("/").pop() || pathname || "index.html";
  return `${route}${VIEW_HASHES[view]}`;
}

function createNavigationLink(
  root: Document,
  label: string,
  href: string,
  view?: SimulatorView,
): HTMLAnchorElement {
  const link = root.createElement("a");
  link.className = "simulator-view-tab";
  link.href = href;
  link.textContent = label;
  if (view) link.dataset.simulatorView = view;
  return link;
}

function createDisabledNavigationItem(
  root: Document,
  label: string,
): HTMLSpanElement {
  const item = root.createElement("span");
  item.className = "simulator-view-tab simulator-view-tab-disabled";
  item.textContent = label;
  item.setAttribute("aria-disabled", "true");
  item.title = "Choose a profession first";
  return item;
}

function mountAnalysisHeading(root: Document): void {
  const results = root.getElementById("rotation-results");
  if (!results || root.getElementById("analysis-view-title")) return;

  const heading = root.createElement("div");
  heading.className = "analysis-view-heading";
  heading.innerHTML = `
    <p>Simulation output</p>
    <h2 id="analysis-view-title">Combat analysis</h2>
    <span>Damage breakdown, DPS over time, and modifier contributions for the current workspace.</span>
  `;
  results.before(heading);
  results.setAttribute("aria-labelledby", "analysis-view-title");
}

function mountProfessionBrowser(root: Document, header: HTMLElement): void {
  if (root.querySelector(".profession-browser-view")) return;

  const section = root.createElement("section");
  section.className = "profession-browser-view";
  section.setAttribute("aria-labelledby", "profession-browser-title");
  section.innerHTML = `
    <div class="profession-browser-heading">
      <p class="landing-eyebrow">Profession simulators</p>
      <h2 id="profession-browser-title">Choose a profession</h2>
      <span>Your current workspace stays loaded until you open a different profession.</span>
    </div>
    <div class="profession-grid" data-profession-grid></div>
  `;

  const snapshot = header.nextElementSibling;
  if (snapshot?.classList.contains("update-info")) snapshot.after(section);
  else header.after(section);
}

function updateActiveView(root: Document, view: SimulatorView): void {
  if (!root.body) return;
  root.body.dataset.simulatorView = view;
  if (view !== "workspace") resetRotationWorkspace(root);

  for (const link of root.querySelectorAll<HTMLAnchorElement>(
    ".simulator-view-tab[data-simulator-view]",
  )) {
    const active = link.dataset.simulatorView === view;
    link.classList.toggle("simulator-view-tab-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

/** Mounts the shared Professions / Workspace / Analysis navigation. */
export function mountSimulatorNavigation(root: Document = document): void {
  const body = root.body;
  const header = root.querySelector<HTMLElement>("#app > header");
  if (!body || !header || header.querySelector(".simulator-view-tabs")) return;

  const navigation = root.createElement("nav");
  navigation.className = "simulator-view-tabs";
  navigation.setAttribute("aria-label", "Simulator sections");

  const professionId = body.dataset.profession;

  if (!professionId) {
    const professionsLink = createNavigationLink(
      root,
      "Professions",
      isEmbedded() ? embedRoute("index.html") : "index.html",
    );
    professionsLink.classList.add("simulator-view-tab-active");
    professionsLink.setAttribute("aria-current", "page");
    navigation.append(
      professionsLink,
      createDisabledNavigationItem(root, "Workspace"),
      createDisabledNavigationItem(root, "Analysis"),
    );
    header.prepend(navigation);
    return;
  }

  const pathname = root.defaultView?.location.pathname || "index.html";
  header.querySelector(".profession-picker")?.remove();
  mountProfessionBrowser(root, header);
  for (const view of ["professions", "workspace", "analysis"] as const) {
    const route = simulatorViewHref(pathname, view);
    const link = createNavigationLink(
      root,
      view === "professions"
        ? "Professions"
        : view === "workspace"
          ? "Workspace"
          : "Analysis",
      isEmbedded() ? embedRoute(route) : route,
      view,
    );
    link.addEventListener("click", (event) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      const window = root.defaultView;
      if (window?.location.hash !== VIEW_HASHES[view]) {
        window?.history.pushState(null, "", VIEW_HASHES[view]);
      }
      updateActiveView(root, view);
      window?.scrollTo({ top: 0, behavior: "auto" });
    });
    navigation.append(link);
  }

  header.prepend(navigation);
  mountAnalysisHeading(root);
  updateActiveView(
    root,
    simulatorViewFromHash(root.defaultView?.location.hash || ""),
  );
  root.defaultView?.addEventListener("hashchange", () => {
    updateActiveView(
      root,
      simulatorViewFromHash(root.defaultView?.location.hash || ""),
    );
  });
}
