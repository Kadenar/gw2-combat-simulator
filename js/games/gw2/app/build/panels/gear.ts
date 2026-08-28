import { FOOD_GROUPS } from '../../../platform/equipment/consumables/food.js';
import { GEAR_SLOTS, INFUSION_BONUS, INFUSION_STATS, PREFIX_GROUPS } from '../../../platform/equipment/gear/stats.js';
import { RELIC_GROUPS } from '../../../platform/equipment/relics/catalog.js';
import { RUNE_GROUPS } from '../../../platform/equipment/gear/runes.js';
import { SIGIL_GROUPS } from '../../../platform/equipment/sigils/catalog.js';
import { UTILITY_GROUPS } from '../../../platform/equipment/consumables/utilities.js';
import { setWeaponSigil } from '../../../platform/equipment/sigils/loadout.js';
import { escapeHtml, groupedOptions, option } from '../../presentation/shared/html.js';
import { requiredElement, requiredInput, requiredSelect } from '../../../../../ui/shared/dom.js';
import {
  foodOptionLabel,
  prefixOptionLabel,
  relicOptionLabel,
  runeOptionLabel,
  sigilOptionLabel,
  utilityOptionLabel
} from '../equipment-option-labels.js';

import type { ProfessionAppState } from '../../types.js';

// Short section headings separate related controls without repeating what each select already communicates.
function sectionHeading(label: string): string {
  return `<div class="gear-section-heading">${label}</div>`;
}

// The native select remains the state source while the visible trigger keeps the closed control compact.
function compactSelect(selectedLabel: string, selectHtml: string): string {
  return `<div class="gear-select-display">${selectHtml}<button type="button" class="gear-select-trigger">${escapeHtml(selectedLabel)}</button></div>`;
}

function splitOptionLabel(label: string): { name: string; details: string } {
  const separator = ' \u2014 ';
  const separatorIndex = label.indexOf(separator);
  return separatorIndex < 0
    ? { name: label, details: '' }
    : { name: label.slice(0, separatorIndex), details: label.slice(separatorIndex + separator.length) };
}

// Upgrade detailed native selects into styled popovers while preserving their existing change handlers and values.
function enhanceDetailedSelect(select: HTMLSelectElement, index: number): void {
  const display = select.parentElement;
  const trigger = display?.querySelector('.gear-select-trigger');
  if (!(display instanceof HTMLElement) || !(trigger instanceof HTMLButtonElement)) return;

  const menu = document.createElement('div');
  const menuId = `gear-select-menu-${index}`;
  menu.id = menuId;
  menu.className = 'gear-select-menu';
  menu.setAttribute('popover', 'auto');
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', select.getAttribute('aria-label') || 'Equipment options');
  trigger.setAttribute('popovertarget', menuId);
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  const addOption = (optionElement: HTMLOptionElement, parent: HTMLElement): void => {
    const { name, details } = splitOptionLabel(optionElement.textContent);
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'gear-select-option';
    choice.dataset.value = optionElement.value;
    choice.disabled = optionElement.disabled;
    choice.setAttribute('role', 'option');
    choice.setAttribute('aria-selected', String(optionElement.selected));

    const primary = document.createElement('span');
    primary.className = 'gear-option-name';
    primary.textContent = name;
    choice.append(primary);
    if (details) {
      const supporting = document.createElement('span');
      supporting.className = 'gear-option-detail';
      supporting.textContent = details;
      choice.append(supporting);
    }

    choice.addEventListener('click', () => {
      menu.hidePopover();
      select.value = optionElement.value;
      trigger.textContent = name;
      menu.querySelectorAll('[role="option"]').forEach((item) => {
        item.setAttribute('aria-selected', String(item === choice));
      });
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    parent.append(choice);
  };

  for (const child of select.children) {
    if (child instanceof HTMLOptGroupElement) {
      const group = document.createElement('div');
      group.className = 'gear-select-group';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', child.label);
      const heading = document.createElement('div');
      heading.className = 'gear-select-group-label';
      heading.textContent = child.label;
      group.append(heading);
      for (const optionElement of child.children) {
        if (optionElement instanceof HTMLOptionElement) addOption(optionElement, group);
      }

      menu.append(group);
    } else if (child instanceof HTMLOptionElement) {
      addOption(child, menu);
    }
  }

  menu.addEventListener('toggle', () => {
    const isOpen = menu.matches(':popover-open');
    trigger.setAttribute('aria-expanded', String(isOpen));
    display.classList.toggle('is-open', isOpen);
    if (!isOpen) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(triggerRect.left, window.innerWidth - menuRect.width - 8))}px`;
    menu.style.top = `${
      triggerRect.bottom + menuRect.height + 2 <= window.innerHeight
        ? triggerRect.bottom + 2
        : Math.max(8, triggerRect.top - menuRect.height - 2)
    }px`;
    menu.querySelector<HTMLButtonElement>('[aria-selected="true"]:not(:disabled)')?.focus();
  });

  menu.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const choices = [...menu.querySelectorAll<HTMLButtonElement>('.gear-select-option:not(:disabled)')];
    const currentIndex = choices.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? choices.length - 1
          : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
    event.preventDefault();
    choices[nextIndex]?.focus();
  });

  display.append(menu);
}

function selectRow(label: string, id: string, selectedLabel: string, optionsHtml: string): string {
  return `<div class="gear-row"><span class="gear-label">${label}</span>
            ${compactSelect(selectedLabel, `<select class="gear-select" id="${id}">${optionsHtml}</select>`)}</div>`;
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
    statSlot: string,
    hidden = false
  ): string => `<div class="gear-row"${hidden ? ' style="display:none"' : ''}>
                <span class="gear-label">${label}</span>
                ${compactSelect(
                  prefix,
                  `<select class="gear-select ${className}" ${attributes}>
                    ${groupedOptions(PREFIX_GROUPS, prefix, (name) => prefixOptionLabel(name, statSlot))}
                </select>`
                )}
            </div>`;
  const armorRows = GEAR_SLOTS.filter((slot) => slot !== 'Weapon1' && slot !== 'Weapon2')
    .map((slot) =>
      gearPrefixRow(slot === 'Leggins' ? 'Leggings' : slot, b.gear[slot], 'gear-prefix', `data-slot="${slot}"`, slot)
    )
    .join('');
  const weaponPrefixRows = (setNumber: number, weapons: string[], prefixes: string[], allowEmpty = false): string => {
    const setTwoHanded = app.weaponData[weapons[0]]?.wielding === '2h';
    const setUnequipped = allowEmpty && !weapons[0];
    return `<div class="gear-section-heading"${setUnequipped ? ' style="display:none"' : ''}>${
      hasSecondWeaponSet ? `Weapon set ${setNumber}` : 'Weapon'
    }</div>
        ${[0, 1]
          .map((slot) =>
            gearPrefixRow(
              setTwoHanded && slot === 0 ? 'Weapon (2H)' : `Weapon ${slot + 1}`,
              prefixes[slot],
              'weapon-prefix',
              `id="sel-stat${setNumber}-${slot + 1}" data-set="${setNumber}" data-slot="${slot}"`,
              setTwoHanded && slot === 0 ? 'Weapon2H' : `Weapon${slot + 1}`,
              setUnequipped || (setTwoHanded && slot === 1)
            )
          )
          .join('')}`;
  };

  // Keep the bulk prefix action in the header so the equipment column contains only per-slot rows.
  requiredElement('gear-set-all').innerHTML = `<span>Set all</span>
      ${compactSelect(
        'Choose prefix',
        `<select class="gear-select" id="sel-set-all">
        <option value="">Choose prefix</option>
        ${groupedOptions(PREFIX_GROUPS, '', (name) => prefixOptionLabel(name))}
      </select>`
      )}`;
  requiredElement('gear-slots').innerHTML = `${sectionHeading('Equipment')}
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
    return `<div class="gear-section-heading">Weapon set${hasSecondWeaponSet ? ` ${setNumber}` : ''}</div>
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
                      sigils[slot],
                      groupedOptions(
                        SIGIL_GROUPS,
                        sigils[slot],
                        sigilOptionLabel,
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
            ${sectionHeading('Upgrades')}
            ${selectRow('Rune', 'sel-rune', b.rune, groupedOptions(RUNE_GROUPS, b.rune, runeOptionLabel))}
            ${selectRow('Relic', 'sel-relic', b.relic, groupedOptions(RELIC_GROUPS, b.relic, relicOptionLabel))}
            ${selectRow('Food', 'sel-food', b.food, groupedOptions(FOOD_GROUPS, b.food, foodOptionLabel))}
            ${selectRow('Utility', 'sel-utility', b.utility, groupedOptions(UTILITY_GROUPS, b.utility, utilityOptionLabel))}
            <div class="gear-row"><span class="gear-label">Jade Bot</span>
                <input type="checkbox" id="chk-jbc" class="gear-checkbox"${b.jadeBotCore ? ' checked' : ''}>
            </div>
            ${b.infusions
              .map(
                (infusion, index) => `<div class="gear-row infusion-row">
                <span class="gear-label">Infusion ${index + 1}</span>
                <div class="infusion-controls">
                    <input class="inf-count" data-index="${index}" type="number" min="0" max="18" value="${infusion.count}">
                    ${compactSelect(
                      infusion.stat,
                      `<select class="gear-select inf-stat" data-index="${index}">
                        ${INFUSION_STATS.map((stat) => option(stat, infusion.stat, `${stat} (+${INFUSION_BONUS} each)`)).join('')}
                    </select>`
                    )}
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
  document.querySelectorAll('.gear-select-display > select').forEach((select, index) => {
    if (select instanceof HTMLSelectElement) enhanceDetailedSelect(select, index);
  });
}
