import { escapeHtml as esc } from "../../platform/ui/html.js";
import { assumptionControlsForSpecialization } from "../profession/assumptions.js";
import {
  STACKING_TARGET_CONDITIONS,
  TARGET_CONDITION_GROUPS,
} from "./options.js";

const PERMANENT_BOONS = [
  ["fury", "Fury"],
  ["quickness", "Quickness"],
  ["alacrity", "Alacrity"],
  ["protection", "Protection"],
  ["resolution", "Resolution"],
  ["regeneration", "Regeneration"],
  ["swiftness", "Swiftness"],
  ["vigor", "Vigor"],
  ["aegis", "Aegis"],
];

const EFFECT_COLORS = {
  Might: "#d9a441",
  Fury: "#d65e5e",
  Quickness: "#67c8d4",
  Alacrity: "#9069d8",
  Protection: "#4f9ec2",
  Resolution: "#d48f45",
  Regeneration: "#5ebc72",
  Swiftness: "#62a7cb",
  Vigor: "#78bd45",
  Aegis: "#d9b85f",
  Vulnerability: "#d67575",
  Weakness: "#9a8f62",
  Blindness: "#727272",
  Slow: "#765bab",
  Chilled: "#69a8d7",
  Cripple: "#a66e73",
  Immobilize: "#8d5c38",
  Burning: "#ed6b38",
  Bleeding: "#c84848",
  Torment: "#8f62c2",
  Confusion: "#b65db0",
  Poisoned: "#70a33e",
};

export function renderAssumptions(app) {
  const a = app.build.assumptions;
  const assumptionControls = assumptionControlsForSpecialization(
    app.adapter.assumptionControls,
    app.adapter.eliteSpecialization(app.build),
  );
  const conditions = (a.targetConditions ||= {});
  const item = ({
    name,
    checked,
    type,
    key = name,
    stacks = null,
  }) => `<label class="perma-item" style="--pc:${EFFECT_COLORS[name] || "#aaa"}">
            <input type="checkbox" data-effect-type="${type}" data-effect-key="${esc(key)}"${checked ? " checked" : ""}>
            <span class="perma-name">${esc(name)}</span>
            ${stacks == null ? "" : `<input type="number" class="perma-stacks" data-effect-type="${type}" data-effect-key="${esc(key)}" min="0" max="25" value="${stacks}"${checked ? "" : " disabled"}>`}
        </label>`;
  const boonItems = [
    item({
      name: "Might",
      checked: Number(a.might) > 0,
      type: "boon",
      key: "might",
      stacks: Math.max(0, Math.min(25, Number(a.might) || 0)),
    }),
    ...PERMANENT_BOONS.map(([key, name]) =>
      item({
        name,
        checked: !!a[key],
        type: "boon",
        key,
      }),
    ),
  ].join("");
  const conditionGroups = TARGET_CONDITION_GROUPS.map((group) => {
    const conditionItems = group.conditions
      .map((name) => {
        const stackable = STACKING_TARGET_CONDITIONS.has(name);
        const value = conditions[name];
        return item({
          name,
          checked: stackable ? Number(value) > 0 : !!value,
          type: "condition",
          stacks: stackable
            ? Math.max(0, Math.min(25, Number(value) || 0))
            : null,
        });
      })
      .join("");
    return `<div class="perma-group">
                <span class="perma-group-label">${esc(group.label)}</span>
                ${conditionItems}
            </div>`;
  }).join("");
  const assumptionOptionIcon = (option) =>
    option.icon || app.skillById.get(Number(option.skillId))?.icon || "";
  const professionAssumptionItem = (control) => {
    const value = a[control.key] ?? control.defaultValue;
    if (control.type === "boolean") {
      return `<label class="boon-control"><input data-assumption-key="${esc(control.key)}" data-assumption-type="boolean" type="checkbox"${value ? " checked" : ""}> ${esc(control.label)}</label>`;
    }
    if (control.type === "select") {
      const hasIcons = control.options.some(assumptionOptionIcon);
      if (hasIcons) {
        const selected =
          control.options.find((option) => option.value === String(value)) ||
          control.options[0];
        return `<div class="boon-control assumption-icon-control">
                        <span>${esc(control.label)}</span>
                        <details class="assumption-icon-select">
                            <summary>
                                <img src="${esc(assumptionOptionIcon(selected))}" alt="">
                                <span>${esc(selected.label)}</span>
                            </summary>
                            <div class="assumption-icon-options" role="listbox"
                                aria-label="${esc(control.label)}">
                                ${control.options
                                  .map(
                                    (option) =>
                                      `<button type="button" role="option"
                                        aria-selected="${option.value === String(value)}"
                                        data-assumption-option-key="${esc(control.key)}"
                                        data-assumption-option-value="${esc(option.value)}">
                                        <img src="${esc(assumptionOptionIcon(option))}" alt="">
                                        <span>${esc(option.label)}</span>
                                    </button>`,
                                  )
                                  .join("")}
                            </div>
                        </details>
                    </div>`;
      }
      return `<label class="boon-control">${esc(control.label)}
                    <select class="gear-select" data-assumption-key="${esc(control.key)}" data-assumption-type="select">
                        ${control.options
                          .map(
                            (option) =>
                              `<option value="${esc(option.value)}"${String(value) === option.value ? " selected" : ""}>${esc(option.label)}</option>`,
                          )
                          .join("")}
                    </select>
                </label>`;
    }
    return `<label class="boon-control">${esc(control.label)}
                <input data-assumption-key="${esc(control.key)}" data-assumption-type="number" type="number"
                    min="${control.minimum}" max="${control.maximum}" step="${control.step}" value="${Number(value)}">
            </label>`;
  };
  const professionAssumptionItems = assumptionControls
    .filter((control) => control.section !== "simulation")
    .map(professionAssumptionItem)
    .join("");
  const simulationAssumptionItems = assumptionControls
    .filter((control) => control.section === "simulation")
    .map(professionAssumptionItem)
    .join("");
  const container = document.getElementById("perma-boons");
  container.innerHTML = `
            <div class="perma-group"><span class="perma-group-label">Boons</span>${boonItems}</div>
            ${conditionGroups}
            <div class="perma-group"><span class="perma-group-label">Target</span>
                <label class="boon-control">Skill activations/s <input id="target-skill-activations" type="number" min="0" max="10" step="0.1" value="${a.targetSkillActivationsPerSecond}"></label>
                <label class="boon-control"><input id="target-moving" type="checkbox"${a.targetMoving ? " checked" : ""}> Moving</label>
                ${professionAssumptionItems}
            </div>
            <div class="perma-group"><span class="perma-group-label">Party</span>
                <label class="boon-control">Additional allied players <input id="allied-player-count" type="number" min="0" max="4" step="1" value="${Number(a.alliedPlayerCount || 0)}"></label>
            </div>
            ${
              simulationAssumptionItems
                ? `<div class="perma-group"><span class="perma-group-label">Simulation</span>${simulationAssumptionItems}</div>`
                : ""
            }`;

  container
    .querySelectorAll('input[type="checkbox"][data-effect-type]')
    .forEach((check) =>
      check.addEventListener("change", () => {
        const { effectType, effectKey } = check.dataset;
        const stackInput = container.querySelector(
          `input[type="number"][data-effect-type="${effectType}"][data-effect-key="${effectKey}"]`,
        );
        if (stackInput) {
          stackInput.disabled = !check.checked;
          if (check.checked && Number(stackInput.value) < 1) {
            stackInput.value = "1";
          }
        }
        const value = stackInput
          ? check.checked
            ? Math.max(1, Number(stackInput.value) || 1)
            : 0
          : check.checked;
        if (effectType === "boon") {
          a[effectKey] = value;
        } else if (value) {
          conditions[effectKey] = value;
        } else {
          delete conditions[effectKey];
        }
        app.changed();
      }),
    );
  container
    .querySelectorAll('input[type="number"][data-effect-type]')
    .forEach((input) =>
      input.addEventListener("change", () => {
        const value = Math.max(0, Math.min(25, Number(input.value) || 0));
        const { effectType, effectKey } = input.dataset;
        input.value = value;
        if (effectType === "boon") {
          a[effectKey] = value;
        } else if (value) {
          conditions[effectKey] = value;
        } else {
          delete conditions[effectKey];
        }
        app.changed();
      }),
    );
  document
    .getElementById("target-skill-activations")
    .addEventListener("change", (event) => {
      a.targetSkillActivationsPerSecond = Math.max(
        0,
        Math.min(10, Number(event.target.value) || 0),
      );
      app.changed();
    });
  document
    .getElementById("target-moving")
    .addEventListener("change", (event) => {
      a.targetMoving = event.target.checked;
      app.changed();
    });
  document
    .getElementById("allied-player-count")
    .addEventListener("change", (event) => {
      a.alliedPlayerCount = Math.max(
        0,
        Math.min(4, Math.trunc(Number(event.target.value) || 0)),
      );
      app.changed();
    });
  container.querySelectorAll("[data-assumption-key]").forEach((control) => {
    control.addEventListener("change", () => {
      const definition = assumptionControls.find(
        (candidate) => candidate.key === control.dataset.assumptionKey,
      );
      if (!definition) return;
      if (definition.type === "boolean") {
        a[definition.key] = control.checked;
      } else if (definition.type === "number") {
        a[definition.key] = Math.max(
          definition.minimum,
          Math.min(definition.maximum, Number(control.value) || 0),
        );
      } else {
        a[definition.key] = control.value;
      }
      app.changed();
    });
  });
  container
    .querySelectorAll("[data-assumption-option-key]")
    .forEach((option) => {
      option.addEventListener("click", () => {
        const definition = assumptionControls.find(
          (candidate) => candidate.key === option.dataset.assumptionOptionKey,
        );
        const value = option.dataset.assumptionOptionValue;
        if (
          !definition ||
          !definition.options.some((candidate) => candidate.value === value)
        )
          return;
        a[definition.key] = value;
        app.changed();
      });
    });
  document.getElementById("target-hp").value = app.build.targetHealth;
  document.getElementById("target-armor").value = app.build.targetArmor;
}
