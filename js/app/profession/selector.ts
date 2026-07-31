/**
 * Registry-driven profession navigation for the landing page and simulator
 * headers.
 *
 * Binding renders an optional landing-page card grid, rebuilds an optional
 * profession select, applies the active profession's theme, and navigates on
 * selection changes. Importing this module in a browser binds the current
 * document automatically; importing it outside a browser has no side effect.
 */

import {
  getProfessionEntry,
  professionRegistry,
  PROFESSION_ROUTES,
  professionRoute,
} from "./registry.js";

export {
  // Kept here as compatibility exports for existing selector consumers.
  PROFESSION_ROUTES,
  professionRoute,
};

function activeProfessionId(root: Document, select: HTMLSelectElement): string {
  return root.body?.dataset.profession || select.dataset.activeProfession || "";
}

function populateProfessionSelector(
  select: HTMLSelectElement,
  active: string,
): void {
  const owner = select.ownerDocument || document;
  select.replaceChildren();
  if (!active) {
    const placeholder = owner.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a simulator…";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.append(placeholder);
  }
  for (const entry of professionRegistry) {
    const option = owner.createElement("option");
    option.value = entry.id;
    option.textContent = entry.name;
    option.selected = entry.id === active;
    select.append(option);
  }
}

function renderProfessionCards(root: Document): void {
  const grid = root.querySelector("[data-profession-grid]");
  if (!grid) return;
  grid.replaceChildren();
  for (const entry of professionRegistry) {
    const card = root.createElement("a");
    card.className = `profession-card profession-card-${entry.id}`;
    card.href = entry.route;

    const mark = root.createElement("span");
    mark.className = "profession-mark";
    mark.ariaHidden = "true";
    const fallback = root.createElement("span");
    fallback.className = "profession-mark-fallback";
    fallback.textContent = entry.name.charAt(0);
    mark.append(fallback);
    if (entry.icon) {
      const icon = root.createElement("img");
      icon.className = "profession-mark-icon";
      icon.src = entry.icon;
      icon.alt = "";
      icon.loading = "lazy";
      icon.decoding = "async";
      icon.addEventListener(
        "load",
        () => {
          fallback.hidden = true;
        },
        { once: true },
      );
      icon.addEventListener("error", () => icon.remove(), { once: true });
      mark.append(icon);
    }

    const copy = root.createElement("span");
    copy.className = "profession-card-copy";
    const name = root.createElement("strong");
    name.textContent = entry.name;
    const summary = root.createElement("small");
    summary.textContent = entry.specializationSummary;
    copy.append(name, summary);

    const action = root.createElement("span");
    action.className = "profession-card-action";
    action.textContent = "Open simulator →";
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
  const select = root.getElementById(
    "profession-select",
  ) as HTMLSelectElement | null;
  renderProfessionCards(root);
  if (!select) return;

  const active = activeProfessionId(root, select);
  const entry = getProfessionEntry(active);
  if (entry?.themeClass && root.body) {
    root.body.classList.add(entry.themeClass);
  }
  populateProfessionSelector(select, entry?.id || "");

  select.addEventListener("change", () => {
    const route = professionRoute(select.value);
    const current =
      globalThis.location?.pathname?.split("/").pop() || "index.html";
    if (current !== route) globalThis.location.assign(route);
  });
}

if (typeof document !== "undefined") {
  bindProfessionSelector(document);
}
