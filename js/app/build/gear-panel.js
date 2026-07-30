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

function selectRow(label, id, optionsHtml) {
  return `<div class="gear-row"><span class="gear-label">${label}</span>
            <select class="gear-select" id="${id}">${optionsHtml}</select></div>`;
}

export function renderGear(app) {
  const b = app.build;
  const twoHanded = app.weaponData[b.weapons[0]]?.wielding === "2h";
  document.getElementById("gear-slots").innerHTML = GEAR_SLOTS.map((slot) => {
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
    select.addEventListener("change", () => {
      app.build.gear[select.dataset.slot] = select.value;
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
  const weaponSetRows = (setNumber, weapons, sigils, allowEmpty = false) => {
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
  document.getElementById("weapon-select").innerHTML = `
            ${weaponSetRows(1, b.weapons, b.weaponSigils[0])}
            ${weaponSetRows(2, b.alternateWeapons, b.weaponSigils[1], true)}`;
  const bindWeaponSet = (setNumber, weapons, sigils) => {
    document
      .getElementById(`sel-mh${setNumber}`)
      .addEventListener("change", (event) => {
        weapons[0] = event.target.value;
        if (!event.target.value) {
          weapons[1] = "";
          b.startingWeaponSet = 1;
          app.attributeWeaponSet = 1;
        } else if (app.weaponData[event.target.value].wielding === "2h")
          weapons[1] = "";
        else if (!weapons[1]) {
          weapons[1] =
            app.adapter.defaultOffhand({
              mainHand: event.target.value,
              offHands,
            }) ||
            offHands[0] ||
            "";
        }
        app.changed();
      });
    document
      .getElementById(`sel-oh${setNumber}`)
      .addEventListener("change", (event) => {
        weapons[1] = event.target.value;
        app.changed();
      });
    for (const slot of [0, 1]) {
      document
        .getElementById(`sel-sig${setNumber}-${slot + 1}`)
        .addEventListener("change", (event) => {
          setWeaponSigil(b, setNumber - 1, slot, event.target.value);
          app.changed();
        });
    }
  };
  bindWeaponSet(1, b.weapons, b.weaponSigils[0]);
  bindWeaponSet(2, b.alternateWeapons, b.weaponSigils[1]);

  document.getElementById("equipment-info").innerHTML = `
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
  const bindValue = (id, setter) =>
    document.getElementById(id).addEventListener("change", (event) => {
      setter(event.target.value);
      app.changed();
    });
  bindValue("sel-rune", (value) => (b.rune = value));
  bindValue("sel-relic", (value) => (b.relic = value));
  bindValue("sel-food", (value) => (b.food = value));
  bindValue("sel-utility", (value) => (b.utility = value));
  document.getElementById("chk-jbc").addEventListener("change", (event) => {
    b.jadeBotCore = event.target.checked;
    app.changed();
  });
  document.querySelectorAll(".inf-count").forEach((input) => {
    input.addEventListener("change", () => {
      const index = Number(input.dataset.index);
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
    select.addEventListener("change", () => {
      b.infusions[Number(select.dataset.index)].stat = select.value;
      app.changed();
    });
  });
}
