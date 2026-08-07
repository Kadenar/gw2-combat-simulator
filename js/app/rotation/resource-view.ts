import type { ProfessionResourceView } from "../../platform/engine/types.js";
import type { ProfessionAppState } from "../profession/types.js";
import { resourceDisplayViews } from "../../platform/ui/resource-display.js";
import { escapeHtml as esc } from "../../platform/ui/html.js";
import { activeSpecialization, professionEndState } from "./context.js";

export function formatResourceValue(value: unknown): string {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return String(Math.round((numeric + Number.EPSILON) * 1000) / 1000);
}

function resourcePipRows(maximum: number, rowCount: number): number[] {
  const rows: number[] = [];
  let remaining = maximum;
  for (let row = 0; row < rowCount; row += 1) {
    const count = Math.ceil(remaining / (rowCount - row));
    rows.push(count);
    remaining -= count;
  }
  return rows;
}

function resourcePipsHtml(
  definition: ProfessionResourceView,
  value: number,
  { interactive = false }: { readonly interactive?: boolean } = {},
): string {
  const pipClass = definition.pipStyle ? ` ${esc(definition.pipStyle)}` : "";
  const pipRows = Number(definition.pipRows || 1);
  const rows = resourcePipRows(definition.maximum, pipRows);
  let index = 0;
  const content = rows
    .map((count) => {
      const pips = Array.from({ length: count }, () => {
        const stateClass = index < value ? " active" : "";
        index += 1;
        if (!interactive) {
          return `<span class="active-resource-pip${stateClass}"></span>`;
        }
        return `<button class="resource-pip${stateClass}"
                data-count="${index}" data-resource-key="${esc(definition.buildKey)}"
                title="${index} ${esc(definition.plural)}"></button>`;
      }).join("");
      return pipRows > 1
        ? `<span class="resource-pip-row">${pips}</span>`
        : pips;
    })
    .join("");
  return `<div class="${
    interactive ? "resource-pips" : "active-resource-pips"
  }${pipClass} pip-rows-${pipRows}">${content}</div>`;
}

function resourceStatusItemsHtml(
  definition: ProfessionResourceView,
): string {
  const items = definition.statusItems || [];
  if (!items.length) return "";
  const label = definition.statusItemsLabel || "Active";
  return `<div class="active-resource-statuses"
      aria-label="${esc(label)}">
      <span class="active-resource-statuses-label">${esc(label)}</span>
      ${items.map((item) => {
        const title = item.title || `${item.label} ${item.valueLabel || ""}`;
        return `<span class="active-resource-status" title="${esc(title.trim())}">
          <span>${esc(item.label)}</span>
          ${item.valueLabel ? `<strong>${esc(item.valueLabel)}</strong>` : ""}
        </span>`;
      }).join("")}
    </div>`;
}

export function activeResourceGroup(app: ProfessionAppState): string {
  const professionState = professionEndState(app.results);
  const definitions = resourceDisplayViews(app.profession, {
    specialization: activeSpecialization(app),
    value: professionState.resource ?? app.build.initialResource,
    professionState,
    initialResource: app.build.initialResource,
    initialBlight: app.build.initialBlight,
  });
  const groups = definitions
    .map((definition) => {
      const buildValue = definition.buildKey
        ? app.build[definition.buildKey]
        : 0;
      const value = Math.max(
        0,
        Math.min(definition.maximum, Number(definition.value ?? buildValue)),
      );
      const displayValue = formatResourceValue(value);
      const title = `${definition.statusLabel} ${definition.plural}: ${displayValue}/${definition.maximum}`;
      const indicator =
        definition.displayMode === "bar"
          ? `<div class="active-resource-bar${
              definition.pipStyle ? ` ${esc(definition.pipStyle)}` : ""
            }"><span style="width:${
              definition.maximum ? (value / definition.maximum) * 100 : 0
            }%"></span></div>`
          : resourcePipsHtml(definition, value);
      return `<div class="pal-group active-resource-group">
            <div class="pal-label" style="color:#c49cff">${esc(definition.shortLabel)}</div>
            <div class="active-resource" data-resource-id="${esc(definition.id)}"
                data-resource-count="${value}" title="${esc(title)}"
                aria-label="${esc(title)}">
                ${indicator}
                <strong>${displayValue}/${definition.maximum}</strong>
            </div>
            ${resourceStatusItemsHtml(definition)}
        </div>`;
    })
    .join("");
  return definitions.length > 1
    ? `<div class="active-resource-stack">${groups}</div>`
    : groups;
}

export function renderStartResource(app: ProfessionAppState): void {
  const element = document.getElementById("start-att-selector");
  if (!element) return;
  const professionState = professionEndState(app.results);
  const definitions = resourceDisplayViews(app.profession, {
    specialization: activeSpecialization(app),
    professionState,
    value: professionState.resource ?? app.build.initialResource,
    initialResource: app.build.initialResource,
    initialBlight: app.build.initialBlight,
  });
  const hasSecondSet = Boolean(app.build.alternateWeapons?.[0]);
  const startSet = app.build.startingWeaponSet === 2 && hasSecondSet ? 2 : 1;
  const weaponControl = hasSecondSet
    ? `<span class="start-att-label">Start weapon:</span>
        <div class="weapon-set-toggle">${[1, 2]
          .map(
            (set) =>
              `<button class="weapon-set-btn${set === startSet ? " active" : ""}"
                data-set="${set}" title="Start on weapon set ${set}">W${set}</button>`,
          )
          .join("")}</div>`
    : "";
  const slotLoadout = app.adapter.slotLoadout;
  const loadoutView = slotLoadout?.view({
    build: app.build,
    specialization: activeSpecialization(app),
    professionState,
    catalog: app.profession.catalog,
  });
  const startingLoadoutId =
    loadoutView && slotLoadout ? app.build[slotLoadout.startingKey] : "";
  const loadoutControl = loadoutView?.bars?.length
    ? `<span class="start-att-label">Start ${esc(
        loadoutView.label.replace(/s$/, "").toLowerCase(),
      )}:</span>
        <div class="start-loadout-toggle">${loadoutView.bars
          .map(
            (bar) =>
              `<button class="start-att-btn start-loadout-btn${
                bar.id === startingLoadoutId ? " active" : ""
              }" data-loadout-id="${esc(bar.id)}" style="--att-c:var(--accent)"
                title="Start with ${esc(bar.compactLabel || bar.label)}">
                <img src="${esc(bar.icon || "")}" alt="">
            </button>`,
          )
          .join("")}</div>`
    : "";
  const bindStartingLoadout = (): void => {
    element
      .querySelectorAll<HTMLElement>(".start-loadout-btn")
      .forEach((button) => {
        button.addEventListener("click", () => {
          if (!slotLoadout) return;
          slotLoadout.updateBuild(
            app.build,
            slotLoadout.startingKey,
            button.dataset.loadoutId || "",
            {
              build: app.build,
              specialization: activeSpecialization(app),
              professionState,
              catalog: app.profession.catalog,
            },
          );
          app.changed();
        });
      });
  };
  if (!definitions.length) {
    element.innerHTML = `${weaponControl}${loadoutControl}`;
    element
      .querySelectorAll<HTMLElement>(".weapon-set-btn")
      .forEach((button) => {
        button.addEventListener("click", () => {
          app.build.startingWeaponSet = Number(button.dataset.set);
          app.changed();
        });
      });
    bindStartingLoadout();
    return;
  }
  const resourceControls = definitions
    .map((definition) => {
      if (definition.canStart === false) return "";
      const key = definition.buildKey || "initialResource";
      const startMaximum = Number(
        definition.startMaximum ?? definition.maximum,
      );
      const value = Math.max(
        0,
        Math.min(startMaximum, Number(app.build[key] || 0)),
      );
      if (definition.displayMode === "bar") {
        return `<div class="start-resource-control start-resource-number">
                <label class="start-att-label">
                    Start ${esc(definition.plural)}:
                </label>
                <input type="number" min="0" max="${startMaximum}"
                    step="${definition.step}" value="${value}"
                    data-resource-key="${esc(key)}">
            </div>`;
      }
      return `<div class="start-resource-control">
            <span class="start-att-label">Start ${esc(definition.plural)}:</span>
            ${resourcePipsHtml(definition, value, { interactive: true })}
        </div>`;
    })
    .join("");
  element.innerHTML = `${weaponControl}${loadoutControl}${resourceControls}`;
  element.querySelectorAll<HTMLElement>(".resource-pip").forEach((button) => {
    button.addEventListener("click", () => {
      const count = Number(button.dataset.count);
      const key = button.dataset.resourceKey || "initialResource";
      app.build[key] = count === app.build[key] ? count - 1 : count;
      app.changed();
    });
  });
  element
    .querySelectorAll<HTMLInputElement>("input[data-resource-key]")
    .forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.dataset.resourceKey || "initialResource";
        app.build[key] = Math.max(
          Number(input.min || 0),
          Math.min(Number(input.max), Number(input.value) || 0),
        );
        app.changed();
      });
    });
  element.querySelectorAll<HTMLElement>(".weapon-set-btn").forEach((button) => {
    button.addEventListener("click", () => {
      app.build.startingWeaponSet = Number(button.dataset.set);
      app.changed();
    });
  });
  bindStartingLoadout();
}
