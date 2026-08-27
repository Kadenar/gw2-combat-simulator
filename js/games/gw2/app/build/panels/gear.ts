import { FOOD_GROUPS } from '../../../platform/equipment/consumables/food.js';
import { GEAR_SLOTS, INFUSION_STATS, PREFIX_GROUPS } from '../../../platform/equipment/gear/stats.js';
import { RELIC_GROUPS } from '../../../platform/equipment/relics/catalog.js';
import { RUNE_GROUPS } from '../../../platform/equipment/gear/runes.js';
import { SIGIL_GROUPS } from '../../../platform/equipment/sigils/catalog.js';
import { UTILITY_GROUPS } from '../../../platform/equipment/consumables/utilities.js';
import { setWeaponSigil } from '../../../platform/equipment/sigils/loadout.js';
import { groupedOptions, option } from '../../presentation/shared/html.js';
import { requiredElement, requiredInput, requiredSelect } from '../../../../../ui/shared/dom.js';

import type { ProfessionAppState } from '../../types.js';

function selectRow(label: string, id: string, optionsHtml: string): string {
  return `<div class="gear-row"><span class="gear-label">${label}</span>
            <select class="gear-select" id="${id}">${optionsHtml}</select></div>`;
}

/**
 * @param {ProfessionAppState} app
 * @returns {void}
 */
export function renderGear(app: ProfessionAppState): void {
  const b = app.build;
  const hasSecondWeaponSet = app.profession.ui.weaponSwapChangesSet !== false;
  const gearPrefixRow = (
    label: string,
    prefix: string,
    className: string,
    attributes: string,
    hidden = false
  ): string => `<div class="gear-row"${hidden ? ' style="display:none"' : ''}>
                <span class="gear-label">${label}</span>
                <select class="gear-select ${className}" ${attributes}>
                    ${groupedOptions(PREFIX_GROUPS, prefix)}
                </select>
            </div>`;
  const armorRows = GEAR_SLOTS.filter((slot) => slot !== 'Weapon1' && slot !== 'Weapon2')
    .map((slot) =>
      gearPrefixRow(slot === 'Leggins' ? 'Leggings' : slot, b.gear[slot], 'gear-prefix', `data-slot="${slot}"`)
    )
    .join('');
  const weaponPrefixRows = (setNumber: number, weapons: string[], prefixes: string[], allowEmpty = false): string => {
    const setTwoHanded = app.weaponData[weapons[0]]?.wielding === '2h';
    const setUnequipped = allowEmpty && !weapons[0];
    return `<div class="weapon-set-heading"${setUnequipped ? ' style="display:none"' : ''}>${
      hasSecondWeaponSet ? `Weapon set ${setNumber} stats` : 'Weapon stats'
    }</div>
        ${[0, 1]
          .map((slot) =>
            gearPrefixRow(
              setTwoHanded && slot === 0 ? 'Weapon (2H)' : `Weapon ${slot + 1}`,
              prefixes[slot],
              'weapon-prefix',
              `id="sel-stat${setNumber}-${slot + 1}" data-set="${setNumber}" data-slot="${slot}"`,
              setUnequipped || (setTwoHanded && slot === 1)
            )
          )
          .join('')}`;
  };

  requiredElement('gear-slots').innerHTML = `<div class="gear-row gear-set-all-row">
        <span class="gear-label">Set all</span>
        <select class="gear-select" id="sel-set-all">
          <option value="">— choose prefix —</option>
          ${groupedOptions(PREFIX_GROUPS, '')}
        </select>
      </div>
      ${armorRows}
      ${weaponPrefixRows(1, b.weapons, [b.gear.Weapon1, b.gear.Weapon2])}
      ${hasSecondWeaponSet ? weaponPrefixRows(2, b.alternateWeapons, b.alternateWeaponPrefixes, true) : ''}`;
  document.querySelectorAll('.gear-prefix').forEach((select) => {
    if (!(select instanceof HTMLSelectElement)) return;
    select.addEventListener('change', () => {
      const slot = select.dataset.slot;
      if (!slot) return;
      app.build.gear[slot] = select.value;
      // Keep the live selects in place so native type-ahead followed by
      // Tab advances to the next slot instead of restarting at Helm.
      app.changed(true, false);
    });
  });
  document.querySelectorAll('.weapon-prefix').forEach((select) => {
    if (!(select instanceof HTMLSelectElement)) return;
    select.addEventListener('change', () => {
      const setNumber = Number(select.dataset.set);
      const slot = Number(select.dataset.slot);
      if (![1, 2].includes(setNumber) || ![0, 1].includes(slot)) return;
      if (setNumber === 1) {
        b.gear[`Weapon${slot + 1}`] = select.value;
      } else {
        b.alternateWeaponPrefixes[slot] = select.value;
      }

      app.changed(true, false);
    });
  });
  const setAllSelect = document.getElementById('sel-set-all');
  if (setAllSelect instanceof HTMLSelectElement) {
    setAllSelect.addEventListener('change', () => {
      const value = setAllSelect.value;
      if (!value) return;
      for (const slot of GEAR_SLOTS) {
        b.gear[slot] = value;
      }

      if (hasSecondWeaponSet) {
        b.alternateWeaponPrefixes[0] = value;
        b.alternateWeaponPrefixes[1] = value;
      }

      app.changed();
    });
  }

  const mainHands = Object.entries(app.weaponData)
    .filter(([, data]) => ['mh', 'mh+oh', '2h'].includes(data.wielding))
    .map(([name]) => name);
  const offHands = Object.entries(app.weaponData)
    .filter(([, data]) => ['oh', 'mh+oh'].includes(data.wielding))
    .map(([name]) => name);
  const weaponSetRows = (setNumber: number, weapons: string[], sigils: string[], allowEmpty = false): string => {
    const setTwoHanded = app.weaponData[weapons[0]]?.wielding === '2h';
    const setUnequipped = allowEmpty && !weapons[0];
    const disabledStyle = setUnequipped ? 'display:none' : setTwoHanded ? 'opacity:.4;pointer-events:none' : '';
    return `<div class="weapon-set-heading">Weapon set${hasSecondWeaponSet ? ` ${setNumber}` : ''}</div>
                <div class="gear-row"><span class="gear-label">Main hand</span>
                    <select id="sel-mh${setNumber}" class="gear-select">${
                      allowEmpty ? option('', weapons[0], 'None') : ''
                    }${mainHands.map((name) => option(name, weapons[0])).join('')}</select>
                </div>
                <div class="gear-row" style="${disabledStyle}">
                    <span class="gear-label">Off hand</span>
                    <select id="sel-oh${setNumber}" class="gear-select">${offHands.map((name) => option(name, weapons[1])).join('')}</select>
                </div>
                <div style="${setUnequipped ? 'display:none' : ''}">
                ${[0, 1]
                  .map((slot) =>
                    selectRow(
                      `Sigil ${slot + 1}`,
                      `sel-sig${setNumber}-${slot + 1}`,
                      groupedOptions(
                        SIGIL_GROUPS,
                        sigils[slot],
                        (name) => name,
                        (name) => name === sigils[slot === 0 ? 1 : 0]
                      )
                    )
                  )
                  .join('')}</div>`;
  };

  requiredElement('weapon-select').innerHTML = `
            ${weaponSetRows(1, b.weapons, b.weaponSigils[0])}
            ${hasSecondWeaponSet ? weaponSetRows(2, b.alternateWeapons, b.weaponSigils[1], true) : ''}`;
  const bindWeaponSet = (setNumber: number, weapons: string[]): void => {
    const mainHand = requiredSelect(`sel-mh${setNumber}`);
    mainHand.addEventListener('change', () => {
      weapons[0] = mainHand.value;
      if (!mainHand.value) {
        weapons[1] = '';
        b.startingWeaponSet = 1;
        app.attributeWeaponSet = 1;
      } else if (app.weaponData[mainHand.value]?.wielding === '2h') {
        weapons[1] = '';
      } else if (!weapons[1]) {
        weapons[1] =
          app.adapter.defaultOffhand({
            mainHand: mainHand.value,
            offHands
          }) ||
          offHands[0] ||
          '';
      }

      app.changed();
    });
    const offHand = requiredSelect(`sel-oh${setNumber}`);
    offHand.addEventListener('change', () => {
      weapons[1] = offHand.value;
      app.changed();
    });
    for (const slot of [0, 1]) {
      const sigil = requiredSelect(`sel-sig${setNumber}-${slot + 1}`);
      sigil.addEventListener('change', () => {
        setWeaponSigil(b, setNumber - 1, slot, sigil.value);
        app.changed();
      });
    }
  };

  bindWeaponSet(1, b.weapons);
  if (hasSecondWeaponSet) bindWeaponSet(2, b.alternateWeapons);

  requiredElement('equipment-info').innerHTML = `
            ${selectRow('Rune', 'sel-rune', groupedOptions(RUNE_GROUPS, b.rune))}
            ${selectRow('Relic', 'sel-relic', groupedOptions(RELIC_GROUPS, b.relic))}
            ${selectRow('Food', 'sel-food', groupedOptions(FOOD_GROUPS, b.food))}
            ${selectRow('Utility', 'sel-utility', groupedOptions(UTILITY_GROUPS, b.utility))}
            <div class="gear-row"><span class="gear-label">Jade Bot</span>
                <input type="checkbox" id="chk-jbc" class="gear-checkbox"${b.jadeBotCore ? ' checked' : ''}>
            </div>
            ${b.infusions
              .map(
                (infusion, index) => `<div class="gear-row infusion-row">
                <span class="gear-label">Infusion ${index + 1}</span>
                <div class="infusion-controls">
                    <input class="inf-count" data-index="${index}" type="number" min="0" max="18" value="${infusion.count}">
                    <select class="gear-select inf-stat" data-index="${index}">
                        ${INFUSION_STATS.map((stat) => option(stat, infusion.stat)).join('')}
                    </select>
                </div>
            </div>`
              )
              .join('')}
            <div class="gear-row infusion-total-row"><span class="gear-label">Total</span>
                <span class="inf-total">${b.infusions.reduce((sum, infusion) => sum + infusion.count, 0)}/18</span>
            </div>`;
  const bindValue = (id: string, setter: (value: string) => void): void => {
    const select = requiredSelect(id);
    select.addEventListener('change', () => {
      setter(select.value);
      app.changed();
    });
  };

  bindValue('sel-rune', (value) => (b.rune = value));
  bindValue('sel-relic', (value) => (b.relic = value));
  bindValue('sel-food', (value) => (b.food = value));
  bindValue('sel-utility', (value) => (b.utility = value));
  const jadeBot = requiredInput('chk-jbc');
  jadeBot.addEventListener('change', () => {
    b.jadeBotCore = jadeBot.checked;
    app.changed();
  });
  document.querySelectorAll('.inf-count').forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    input.addEventListener('change', () => {
      const index = Number(input.dataset.index);
      if (!Number.isInteger(index) || !b.infusions[index]) return;
      const other = b.infusions.reduce((sum, infusion, i) => (i === index ? sum : sum + infusion.count), 0);
      b.infusions[index].count = Math.max(0, Math.min(Number(input.value) || 0, 18 - other));
      app.changed();
    });
  });
  document.querySelectorAll('.inf-stat').forEach((select) => {
    if (!(select instanceof HTMLSelectElement)) return;
    select.addEventListener('change', () => {
      const infusion = b.infusions[Number(select.dataset.index)];
      if (!infusion) return;
      infusion.stat = select.value;
      app.changed();
    });
  });
}
