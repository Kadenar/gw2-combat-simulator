import { getProfessionEntry } from '#gw2/app/profession/registry.js';
import { ARMOR_ICONS, EQUIPMENT_ICONS, GEAR_ICONS, INFUSION_ICONS } from '#gw2/platform/equipment/icons.js';
import { SIGIL_DATA } from '#gw2/platform/equipment/sigils/data.js';
import { FOOD_GROUPS } from '#gw2/platform/equipment/consumables/food.js';
import { GEAR_SLOTS, INFUSION_BONUS, INFUSION_STATS, PREFIX_GROUPS } from '#gw2/platform/equipment/gear/stats.js';
import { RELIC_DATA, RELIC_GROUPS, PRECAST_RELIC_NAMES } from '#gw2/platform/equipment/relics/catalog.js';
import {
  candidatePicker,
  updatePicker,
  bindCandidatePickers,
  enhanceDetailedSelect,
  positionGearPopover
} from '#gw2/app/build/equipment-picker.js';
import { RUNE_GROUPS } from '#gw2/platform/equipment/gear/runes.js';
import { SIGIL_GROUPS } from '#gw2/platform/equipment/sigils/catalog.js';
import { UTILITY_GROUPS } from '#gw2/platform/equipment/consumables/utilities.js';
import { canEquipWeaponSigil, setWeaponSigil } from '#gw2/platform/equipment/sigils/loadout.js';
import { escapeHtml, groupedOptions, option } from '#gw2/app/presentation/shared/html.js';
import { requiredElement, requiredSelect } from '#ui/shared/dom.js';
import {
  foodOptionLabel,
  prefixOptionLabel,
  relicOptionLabel,
  runeOptionLabel,
  sigilOptionLabel,
  utilityOptionLabel
} from '#gw2/app/build/equipment-option-labels.js';

import type { ProfessionAppState } from '#gw2/app/types.js';

// Decorative item icons identify equipment slots without inventing selectable armor or trinket items.
function equipmentIcon(source?: string): string {
  return `<span class="gear-item-icon" aria-hidden="true">${source ? `<img src="${escapeHtml(source)}" alt="" width="36" height="36">` : '+'}</span>`;
}

// Short section headings separate related controls without repeating what each select already communicates.
function sectionHeading(label: string): string {
  return `<div class="gear-section-heading">${label}</div>`;
}

// The native select remains the state source while the visible trigger keeps the closed control compact.
function compactSelect(selectedLabel: string, selectHtml: string, icon?: string): string {
  return `<div class="gear-select-display${icon !== undefined ? ' gear-icon-select' : ''}">${selectHtml}<button type="button" class="gear-select-trigger${icon !== undefined ? ' gear-icon-trigger' : ''}" title="${escapeHtml(selectedLabel)}">${icon !== undefined ? equipmentIcon(icon) : escapeHtml(selectedLabel)}</button></div>`;
}

// Icons open the same detailed stat choices while the equipped value remains visible as plain text.
function iconSelectRow(label: string, selected: string, selectHtml: string, icon = ''): string {
  return `<div class="gear-row gear-icon-row">${compactSelect(selected, selectHtml, icon)}<span class="gear-item-caption"><span class="gear-label">${escapeHtml(label)}</span><span class="gear-equipped-name">${escapeHtml(selected)}</span></span></div>`;
}

function selectRow(label: string, id: string, selectedLabel: string, optionsHtml: string, icon?: string): string {
  // Optional upgrades share the optimizer's explicit no-item selection and keep it visible after Apply.
  if (['sel-rune', 'sel-relic', 'sel-food', 'sel-utility'].includes(id)) {
    optionsHtml = option('', selectedLabel, 'None') + optionsHtml;
    selectedLabel ||= 'None';
  }

  if (icon !== undefined)
    return iconSelectRow(
      label,
      selectedLabel,
      `<select class="gear-select" id="${id}" aria-label="${escapeHtml(label)}">${optionsHtml}</select>`,
      icon
    );

  return `<div class="gear-row"><span class="gear-label">${label}</span>
            ${compactSelect(selectedLabel, `<select class="gear-select" id="${id}" aria-label="${escapeHtml(label)}">${optionsHtml}</select>`)}</div>`;
}

export function renderGear(app: ProfessionAppState): void {
  const b = app.build;
  const openWeaponEditor = document.querySelector('.weapon-editor:popover-open')?.id;
  const entry = getProfessionEntry(app.adapter.id);
  // Follow the active build's elite artwork, falling back to its core profession behind the equipment controls.
  const artwork = entry?.specializationArtwork;
  const conceptArt =
    artwork?.find(({ name }) => name === app.adapter.eliteSpecialization(b))?.conceptArt ?? artwork?.[0]?.conceptArt;
  document
    .querySelector<HTMLElement>('.gear-loadout')
    ?.style.setProperty('--gear-artwork', conceptArt ? `url("${conceptArt}")` : 'none');
  const gearPrefixRow = (slot: string): string => {
    const label = slot === 'Leggins' ? 'Leggings' : slot === 'Back' ? 'Back item' : slot.replace(/(\d)$/, ' $1');
    return iconSelectRow(
      label,
      b.gear[slot],
      `<select class="gear-select gear-prefix" data-slot="${slot}" aria-label="${label} stats">${groupedOptions(PREFIX_GROUPS, b.gear[slot], (name) => prefixOptionLabel(name, slot))}</select>`,
      ARMOR_ICONS[entry?.armorWeight || 'light']?.[slot] || GEAR_ICONS[slot.replace(/\d$/, '')] || ''
    );
  };

  // Keep the bulk prefix action in the header so the equipment column contains only per-slot rows.
  requiredElement('gear-set-all').innerHTML = `<span>Set all</span>
      ${compactSelect(
        'Choose prefix',
        `<select class="gear-select" id="sel-set-all" aria-label="Set all equipment stats">
        <option value="">Choose prefix</option>
        ${groupedOptions(PREFIX_GROUPS, '', (name) => prefixOptionLabel(name))}
      </select>`
      )}`;
  requiredElement('gear-slots').innerHTML = GEAR_SLOTS.slice(0, 6).map(gearPrefixRow).join('');
  // Group backpack/accessories above amulet/rings without a heading so the slots align with armor.
  requiredElement('trinket-slots').innerHTML =
    `<div class="trinket-grid">${['Back', 'Accessory1', 'Accessory2', 'Amulet', 'Ring1', 'Ring2'].map(gearPrefixRow).join('')}</div>`;
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
  const setAllSelect = document.getElementById('sel-set-all');
  if (setAllSelect instanceof HTMLSelectElement) {
    setAllSelect.addEventListener('change', () => {
      const value = setAllSelect.value;
      if (!value) return;
      for (const slot of GEAR_SLOTS) {
        b.gear[slot] = value;
      }

      b.alternateWeaponPrefixes[0] = value;
      b.alternateWeaponPrefixes[1] = value;

      app.changed();
    });
  }

  const mainHands = Object.entries(app.weaponData)
    .filter(([, data]) => ['mh', 'mh+oh', '2h'].includes(data.wielding))
    .map(([name]) => name);
  const offHands = Object.entries(app.weaponData)
    .filter(([, data]) => ['oh', 'mh+oh'].includes(data.wielding))
    .map(([name]) => name);
  // Keep each weapon's stats and sigils together; a two-handed weapon owns both sigil sockets.
  const weaponSetRows = (
    setNumber: number,
    weapons: string[],
    prefixes: string[],
    sigils: string[],
    allowEmpty = false
  ): string => {
    const twoHanded = app.weaponData[weapons[0]]?.wielding === '2h';
    const unequipped = allowEmpty && !weapons[0];
    const sigilRow = (slot: number): string =>
      `<div class="weapon-sigil">${selectRow(
        `Sigil ${slot + 1}`,
        `sel-sig${setNumber}-${slot + 1}`,
        sigils[slot],
        // Disable conflicting groups as well as duplicate sigils using the same rule as build loading.
        groupedOptions(
          SIGIL_GROUPS,
          sigils[slot],
          sigilOptionLabel,
          (name) => !canEquipWeaponSigil(b.weaponSigils, setNumber - 1, slot, name)
        ),
        SIGIL_DATA[sigils[slot]]?.icon || ''
      )}</div>`;
    return `<section class="weapon-set" aria-label="Weapon set ${setNumber}">${sectionHeading(`Weapon set ${setNumber}`)}
      ${[0, 1]
        .map((slot) => {
          const hidden = slot === 1 && (twoHanded || unequipped);
          const label = slot === 0 ? (twoHanded ? 'Two hand' : 'Main hand') : 'Off hand';
          const statSlot = twoHanded && slot === 0 ? 'Weapon2H' : `Weapon${slot + 1}`;
          return `<div class="weapon-slot"${hidden ? ' hidden' : ''}>
          <div class="gear-row gear-icon-row weapon-row">
            <button type="button" class="gear-select-trigger gear-icon-trigger weapon-icon-trigger" popovertarget="weapon-editor-${setNumber}-${slot}" aria-haspopup="dialog" aria-expanded="false" aria-label="Edit weapon set ${setNumber} ${label.toLowerCase()}" title="${escapeHtml(`${weapons[slot] || 'None'} / ${prefixes[slot]}`)}">${equipmentIcon(GEAR_ICONS[weapons[slot]])}</button>
            <span class="gear-item-caption"><span class="gear-label">${label} &middot; ${escapeHtml(weapons[slot] || 'None')}</span><span class="gear-equipped-name">${unequipped ? 'Unequipped' : escapeHtml(prefixes[slot])}</span></span>
            <div id="weapon-editor-${setNumber}-${slot}" class="weapon-editor gear-select-menu" popover="auto" role="dialog" aria-label="Weapon set ${setNumber} ${label.toLowerCase()}">
              <div class="weapon-editor-heading"><strong>${label} &middot; Set ${setNumber}</strong><button type="button" class="btn btn-io" popovertarget="weapon-editor-${setNumber}-${slot}" popovertargetaction="hide" aria-label="Close weapon picker">&times;</button></div>
              <div class="weapon-controls">
              <label for="sel-${slot === 0 ? 'mh' : 'oh'}${setNumber}">Weapon</label>
              <select id="sel-${slot === 0 ? 'mh' : 'oh'}${setNumber}" class="gear-select" aria-label="Weapon set ${setNumber} ${label.toLowerCase()}"${hidden ? ' disabled' : ''}>
                ${slot === 0 && allowEmpty ? option('', weapons[0], 'None') : ''}
                ${(slot === 0 ? mainHands : offHands).map((name) => option(name, weapons[slot])).join('')}
              </select>
              <label for="sel-stat${setNumber}-${slot + 1}"${unequipped ? ' hidden' : ''}>Stats</label>
              <div${unequipped ? ' hidden' : ''}>${compactSelect(
                prefixes[slot],
                `<select class="gear-select weapon-prefix" id="sel-stat${setNumber}-${slot + 1}" data-set="${setNumber}" data-slot="${slot}" aria-label="Weapon set ${setNumber} ${label.toLowerCase()} stats">
                ${groupedOptions(PREFIX_GROUPS, prefixes[slot], (name) => prefixOptionLabel(name, statSlot))}
              </select>`
              )}</div>
              </div>
            </div>
          </div>
          <div class="weapon-sigils"${unequipped ? ' hidden' : ''}>${slot === 0 ? sigilRow(0) + (twoHanded ? sigilRow(1) : '') : twoHanded ? '' : sigilRow(1)}</div>
        </div>`;
        })
        .join('')}
    </section>`;
  };

  // Every profession can equip two sets; combat swap restrictions belong to the rotation palette and engine.
  requiredElement('weapon-select').innerHTML = `
    ${weaponSetRows(1, b.weapons, [b.gear.Weapon1, b.gear.Weapon2], b.weaponSigils[0])}
    ${weaponSetRows(2, b.alternateWeapons, b.alternateWeaponPrefixes, b.weaponSigils[1], true)}`;
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

      const caption = select.closest('.weapon-row')?.querySelector('.gear-equipped-name');
      if (caption) caption.textContent = select.value;
      app.changed(true, false);
    });
  });
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
  bindWeaponSet(2, b.alternateWeapons);

  requiredElement('consumable-info').innerHTML = `${sectionHeading('Consumables')}
            ${selectRow('Food', 'sel-food', b.food, groupedOptions(FOOD_GROUPS, b.food, foodOptionLabel), EQUIPMENT_ICONS[b.food] || '')}
            ${selectRow('Utility', 'sel-utility', b.utility, groupedOptions(UTILITY_GROUPS, b.utility, utilityOptionLabel), EQUIPMENT_ICONS[b.utility] || '')}
            <div class="gear-row gear-icon-row">
                <button type="button" id="btn-jade-bot" class="gear-select-trigger gear-icon-trigger" aria-label="Jade Bot core" aria-pressed="${b.jadeBotCore}" title="${b.jadeBotCore ? 'Disable' : 'Enable'} Jade Bot core">${equipmentIcon(GEAR_ICONS.JadeBot)}</button>
                <span class="gear-item-caption"><span class="gear-label">Jade Bot</span><span class="gear-equipped-name">${b.jadeBotCore ? 'Enabled' : 'Disabled'}</span></span>
            </div>
`;
  requiredElement('equipment-info').innerHTML = `
            <section class="equipment-upgrades workspace-card">${sectionHeading('Upgrades')}
            ${selectRow('Rune', 'sel-rune', b.rune, groupedOptions(RUNE_GROUPS, b.rune, runeOptionLabel), EQUIPMENT_ICONS[b.rune] || '')}
            ${selectRow('Relic', 'sel-relic', b.relic, groupedOptions(RELIC_GROUPS, b.relic, relicOptionLabel), (RELIC_DATA as Record<string, { icon?: string }>)[b.relic]?.icon || '')}
            <div id="precast-relics">
              ${candidatePicker('precastRelics', 'Precast relics', PRECAST_RELIC_NAMES, b.precastRelics || [], 0, relicOptionLabel, 'No precast relics')}
            </div>
            </section>`;
  requiredElement('infusion-info').innerHTML = `${sectionHeading('Infusions')}
            ${b.infusions
              .map(
                // Keep counts directly editable while stat choices use the same icon picker as equipment.
                (infusion, index) => `<div class="infusion-row">
                  ${iconSelectRow(
                    `Infusion ${index + 1}`,
                    infusion.stat,
                    `<select id="sel-inf-stat${index}" class="gear-select inf-stat" aria-label="Infusion ${index + 1} stat" data-index="${index}">
                      ${INFUSION_STATS.map((stat) => option(stat, infusion.stat, `${stat} (+${INFUSION_BONUS} each)`)).join('')}
                    </select>`,
                    INFUSION_ICONS[infusion.stat]
                  )}
                  <input class="inf-count" aria-label="Infusion ${index + 1} count" data-index="${index}" type="number" min="0" max="18" value="${infusion.count}">
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
  // Reuse the icon popover for adding preparation relics while keeping the shared removable chips.
  const precastPicker = requiredElement('precast-relics');
  const precastSelect = precastPicker.querySelector<HTMLSelectElement>('select')!;
  precastSelect.parentElement!.classList.add('gear-icon-select');
  const precastTrigger = precastPicker.querySelector<HTMLButtonElement>('.gear-select-trigger')!;
  precastTrigger.classList.add('gear-icon-trigger');
  precastTrigger.innerHTML = equipmentIcon('');
  precastPicker.querySelectorAll<HTMLElement>('[data-picker]').forEach(updatePicker);
  bindCandidatePickers(precastPicker);
  precastPicker.addEventListener('change', () => {
    b.precastRelics = [...precastPicker.querySelectorAll<HTMLInputElement>('input[name="precastRelics"]')].map(
      (input) => input.value
    );
    app.changed(true, false);
    precastPicker.querySelector<HTMLButtonElement>('.gear-select-trigger')?.focus();
  });
  bindValue('sel-food', (value) => (b.food = value));
  bindValue('sel-utility', (value) => (b.utility = value));
  // Toggle the existing core bonus through an accessible icon button and preserve keyboard focus after refresh.
  requiredElement('btn-jade-bot').addEventListener('click', () => {
    b.jadeBotCore = !b.jadeBotCore;
    app.changed();
    requiredElement('btn-jade-bot').focus();
  });
  document.querySelectorAll('.inf-count').forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    input.addEventListener('change', () => {
      const index = Number(input.dataset.index);
      if (!Number.isInteger(index) || !b.infusions[index]) return;
      const other = b.infusions.reduce((sum, infusion, i) => (i === index ? sum : sum + infusion.count), 0);
      b.infusions[index].count = Math.max(0, Math.min(Math.trunc(Number(input.value) || 0), 18 - other));
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
  document
    .querySelectorAll('.gear-panel select.gear-select, .gear-select-display > select')
    .forEach((select, index) => {
      if (select instanceof HTMLSelectElement) enhanceDetailedSelect(select, index);
    });
  document.querySelectorAll<HTMLButtonElement>('.weapon-icon-trigger').forEach((trigger) => {
    const menu = document.getElementById(trigger.getAttribute('popovertarget')!)!;
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      if (menu.matches(':popover-open')) menu.hidePopover();
      else {
        trigger.focus();
        menu.showPopover();
        positionGearPopover(menu, trigger);
        // Focus the visible control so iOS does not open the hidden native select.
        menu.querySelector<HTMLButtonElement>('.weapon-controls .gear-select-trigger')?.focus({ preventScroll: true });
      }
    });
    menu.addEventListener('toggle', () => trigger.setAttribute('aria-expanded', String(menu.matches(':popover-open'))));
    if (menu.id === openWeaponEditor) trigger.click();
  });
}
