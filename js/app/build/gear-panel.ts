import {
  FOOD_GROUPS,
  GEAR_SLOTS,
  INFUSION_STATS,
  PREFIX_GROUPS,
  RUNE_GROUPS,
  SIGIL_GROUPS,
  UTILITY_NAMES,
} from "../../platform/gw2/gear-data.js";
import { setWeaponSigil } from "../../platform/gw2/weapon-sigils.js";
import { groupedOptions, option } from "./options.js";

import type { ProfessionAppState } from "../profession/types.js";

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required gear control #${id} is missing.`);
  return element;
}

function requiredSelect(id: string): HTMLSelectElement {
  const select = requiredElement(id);
  if (!(select instanceof HTMLSelectElement)) {
    throw new TypeError(`Gear control #${id} must be a select.`);
  }
  return select;
}

function selectRow(
  label: string,
  id: string,
  optionsHtml: string,
): string {
  return `<div class="gear-row"><span class="gear-label">${label}</span>
            <select class="gear-select" id="${id}">${optionsHtml}</select></div>`;
}

/**
 * @param {ProfessionAppState} app
 * @returns {void}
 */
export function renderGear(app: ProfessionAppState): void {
  const b = app.build;
  const twoHanded = app.weaponData[b.weapons[0]]?.wielding === "2h";
  requiredElement("gear-slots").innerHTML = GEAR_SLOTS.map((slot) => {
    const hidden = twoHanded && slot === "Weapon2";
    const label =
      twoHanded && slot === "Weapon1"
        ? "Weapon (2H)"
        : slot === "Leggins"
          ? "Leggings"
          : slot;
    return `<div class="gear-row"${hidden ? ' style="display:none"' : ""}>
                <span class="gear-label">${label}</span>
                <select class="gear-select gear-prefix" data-slot="${slot}">
                    ${groupedOptions(PREFIX_GROUPS, app.build.gear[slot])}
                </select>
            </div>`;
  }).join("");
  document.querySelectorAll(".gear-prefix").forEach((select) => {
    if (!(select instanceof HTMLSelectElement)) return;
    select.addEventListener("change", () => {
      const slot = select.dataset.slot;
      if (!slot) return;
      app.build.gear[slot] = select.value;
      // Keep the live selects in place so native type-ahead followed by
      // Tab advances to the next slot instead of restarting at Helm.
      app.changed(true, false);
    });
  });

  const mainHands = Object.entries(app.weaponData)
    .filter(([, data]) => ["mh", "mh+oh", "2h"].includes(data.wielding))
    .map(([name]) => name);
  const offHands = Object.entries(app.weaponData)
    .filter(([, data]) => ["oh", "mh+oh"].includes(data.wielding))
    .map(([name]) => name);
  const weaponSetRows = (
    setNumber: number,
    weapons: string[],
    sigils: string[],
    allowEmpty = false,
  ): string => {
    const setTwoHanded = app.weaponData[weapons[0]]?.wielding === "2h";
    const setUnequipped = allowEmpty && !weapons[0];
    const disabledStyle = setUnequipped
      ? "display:none"
      : setTwoHanded
        ? "opacity:.4;pointer-events:none"
        : "";
    return `<div class="weapon-set-heading">Weapon set ${setNumber}</div>
                <div class="gear-row"><span class="gear-label">Main hand</span>
                    <select id="sel-mh${setNumber}" class="gear-select">${
                      allowEmpty ? option("", weapons[0], "None") : ""
                    }${mainHands.map((name) => option(name, weapons[0])).join("")}</select>
                </div>
                <div class="gear-row" style="${disabledStyle}">
                    <span class="gear-label">Off hand</span>
                    <select id="sel-oh${setNumber}" class="gear-select">${offHands.map((name) => option(name, weapons[1])).join("")}</select>
                </div>
                <div style="${setUnequipped ? "display:none" : ""}">
                ${[0, 1]
                  .map((slot) =>
                    selectRow(
                      `Sigil ${slot + 1}`,
                      `sel-sig${setNumber}-${slot + 1}`,
                      groupedOptions(
                        SIGIL_GROUPS,
                        sigils[slot],
                        (name) => name,
                        (name) => name === sigils[slot === 0 ? 1 : 0],
                      ),
                    ),
                  )
                  .join("")}</div>`;
  };
  requiredElement("weapon-select").innerHTML = `
            ${weaponSetRows(1, b.weapons, b.weaponSigils[0])}
            ${weaponSetRows(2, b.alternateWeapons, b.weaponSigils[1], true)}`;
  const bindWeaponSet = (
    setNumber: number,
    weapons: string[],
  ): void => {
    const mainHand = requiredSelect(`sel-mh${setNumber}`);
    mainHand.addEventListener("change", () => {
        weapons[0] = mainHand.value;
        if (!mainHand.value) {
          weapons[1] = "";
          b.startingWeaponSet = 1;
          app.attributeWeaponSet = 1;
        } else if (app.weaponData[mainHand.value]?.wielding === "2h") {
          weapons[1] = "";
        } else if (!weapons[1]) {
          weapons[1] =
            app.adapter.defaultOffhand({
              mainHand: mainHand.value,
              offHands,
            }) ||
            offHands[0] ||
            "";
        }
        app.changed();
      });
    const offHand = requiredSelect(`sel-oh${setNumber}`);
    offHand.addEventListener("change", () => {
        weapons[1] = offHand.value;
        app.changed();
      });
    for (const slot of [0, 1]) {
      const sigil = requiredSelect(`sel-sig${setNumber}-${slot + 1}`);
      sigil.addEventListener("change", () => {
          setWeaponSigil(b, setNumber - 1, slot, sigil.value);
          app.changed();
        });
    }
  };
  bindWeaponSet(1, b.weapons);
  bindWeaponSet(2, b.alternateWeapons);

  requiredElement("equipment-info").innerHTML = `
            ${selectRow("Rune", "sel-rune", groupedOptions(RUNE_GROUPS, b.rune))}
            ${selectRow("Relic", "sel-relic", app.relicNames.map((name) => option(name, b.relic)).join(""))}
            ${selectRow("Food", "sel-food", groupedOptions(FOOD_GROUPS, b.food))}
            ${selectRow("Utility", "sel-utility", UTILITY_NAMES.map((name) => option(name, b.utility)).join(""))}
            <div class="gear-row"><span class="gear-label">Jade Bot</span>
                <input type="checkbox" id="chk-jbc" class="gear-checkbox"${b.jadeBotCore ? " checked" : ""}>
            </div>
            ${b.infusions
              .map(
                (infusion, index) => `<div class="gear-row infusion-row">
                <span class="gear-label">Infusion ${index + 1}</span>
                <div class="infusion-controls">
                    <input class="inf-count" data-index="${index}" type="number" min="0" max="18" value="${infusion.count}">
                    <select class="gear-select inf-stat" data-index="${index}">
                        ${INFUSION_STATS.map((stat) => option(stat, infusion.stat)).join("")}
                    </select>
                </div>
            </div>`,
              )
              .join("")}
            <div class="gear-row infusion-total-row"><span class="gear-label">Total</span>
                <span class="inf-total">${b.infusions.reduce((sum, infusion) => sum + infusion.count, 0)}/18</span>
            </div>`;
  const bindValue = (
    id: string,
    setter: (value: string) => void,
  ): void => {
    const select = requiredSelect(id);
    select.addEventListener("change", () => {
      setter(select.value);
      app.changed();
    });
  };
  bindValue("sel-rune", (value) => (b.rune = value));
  bindValue("sel-relic", (value) => (b.relic = value));
  bindValue("sel-food", (value) => (b.food = value));
  bindValue("sel-utility", (value) => (b.utility = value));
  const jadeBot = requiredElement("chk-jbc");
  if (!(jadeBot instanceof HTMLInputElement)) {
    throw new TypeError("#chk-jbc must be a checkbox.");
  }
  jadeBot.addEventListener("change", () => {
    b.jadeBotCore = jadeBot.checked;
    app.changed();
  });
  document.querySelectorAll(".inf-count").forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    input.addEventListener("change", () => {
      const index = Number(input.dataset.index);
      if (!Number.isInteger(index) || !b.infusions[index]) return;
      const other = b.infusions.reduce(
        (sum, infusion, i) => (i === index ? sum : sum + infusion.count),
        0,
      );
      b.infusions[index].count = Math.max(
        0,
        Math.min(Number(input.value) || 0, 18 - other),
      );
      app.changed();
    });
  });
  document.querySelectorAll(".inf-stat").forEach((select) => {
    if (!(select instanceof HTMLSelectElement)) return;
    select.addEventListener("change", () => {
      const infusion = b.infusions[Number(select.dataset.index)];
      if (!infusion) return;
      infusion.stat = select.value;
      app.changed();
    });
  });
}
