// Equipment editors keep temporary selections local and commit a complete edit only when Apply is pressed.
import { GEAR_ICONS } from '#gw2/app/shared/equipment/icons.js';
import { prefixOptionLabel } from '#gw2/app/shared/equipment/labels.js';
import { positionGearPopover } from '#gw2/app/shared/equipment/picker.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { PREFIX_GROUPS } from '#gw2/platform/equipment/gear/prefixes/catalog.js';
import { GEAR_SLOTS } from '#gw2/platform/equipment/gear/slots.js';
import { requiredElement } from '#ui/shared/dom.js';
import { matchesSearchWords } from '#ui/shared/dropdown-search.js';
import { escapeHtml } from '#ui/shared/html.js';

export function gearSlotLabel(slot: string): string {
  return slot === 'Leggins' ? 'Leggings' : slot === 'Back' ? 'Back item' : slot.replace(/(\d)$/, ' $1');
}

function prefixChoices(name: string, selected: string, slot?: string): string {
  return `<fieldset class="equipment-prefix-picker"><legend>Stats</legend>
    <input type="search" class="dropdown-search" aria-label="Search stats" placeholder="Search stats or attributes…" autocomplete="off">
    <div class="equipment-prefix-results">${PREFIX_GROUPS.map(
      (group) =>
        `<div class="equipment-prefix-group"><div class="gear-select-group-label">${group.label}</div>${group.items
          .map((prefix) => {
            const details = prefixOptionLabel(prefix, slot).split(' — ')[1] || '';
            return `<label class="equipment-choice"><input type="radio" name="${name}" value="${escapeHtml(prefix)}"${prefix === selected ? ' checked' : ''}>
          <span><span class="gear-option-name">${escapeHtml(prefix)}</span><span class="gear-option-detail">${escapeHtml(details)}</span></span></label>`;
          })
          .join('')}</div>`
    ).join('')}<p class="dropdown-search-empty" role="status" hidden>No matching choices</p></div></fieldset>`;
}

// Search filters visible choices without changing the draft; arrow keys browse the filtered radio group.
function bindPrefixSearch(root: HTMLElement): void {
  const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
  const choices = [...root.querySelectorAll<HTMLElement>('.equipment-choice')];
  const available = () =>
    choices.filter((choice) => !choice.hidden).map((choice) => choice.querySelector<HTMLInputElement>('input')!);
  search.addEventListener('input', () => {
    for (const choice of choices) choice.hidden = !matchesSearchWords(choice.textContent || '', search.value);
    for (const group of root.querySelectorAll<HTMLElement>('.equipment-prefix-group')) {
      group.hidden = !group.querySelector('.equipment-choice:not([hidden])');
    }

    root.querySelector<HTMLElement>('[role="status"]')!.hidden = available().length > 0;
  });
  search.addEventListener('change', (event) => event.stopPropagation());
  root.addEventListener('keydown', (event) => {
    const inSearch = event.target === search;

    if (inSearch && event.key === 'Enter') {
      event.preventDefault();
      available()[0]?.click();
      return;
    }

    const keys = inSearch
      ? ['ArrowDown', 'ArrowUp']
      : ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];

    if (!keys.includes(event.key)) return;

    event.preventDefault();
    const inputs = available();
    const current = inputs.indexOf(document.activeElement as HTMLInputElement);
    const backwards = ['ArrowUp', 'ArrowLeft', 'End'].includes(event.key);
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? inputs.length - 1
          : current < 0
            ? backwards
              ? inputs.length - 1
              : 0
            : (current + (backwards ? -1 : 1) + inputs.length) % inputs.length;
    inputs[index]?.focus();

    if (!inSearch) inputs[index]?.click();
  });
}

function editorHeading(title: string): string {
  return `<div class="equipment-editor-heading"><strong>${escapeHtml(title)}</strong><button type="button" class="btn btn-io" data-cancel aria-label="Close editor">&times;</button></div>`;
}

function editorFooter(): string {
  return `<div class="equipment-editor-footer"><span class="equipment-editor-summary" aria-live="polite"></span><button type="button" class="btn btn-io" data-cancel>Cancel</button><button type="submit" class="btn" data-apply>Apply</button></div>`;
}

// Recreate drafts on every open, including after light dismissal, and restore the launcher after cancellation.
function bindEditor(trigger: HTMLButtonElement, menu: HTMLElement, populate: () => void): void {
  menu.addEventListener('beforetoggle', (event) => {
    if ((event as ToggleEvent).newState === 'open') populate();
  });
  trigger.addEventListener('click', (event) => {
    event.preventDefault();

    if (menu.matches(':popover-open')) {
      menu.hidePopover();
      return;
    }

    menu.showPopover();
    positionGearPopover(menu, trigger);
    (
      menu.querySelector<HTMLInputElement>('input[type="radio"]:checked') ||
      menu.querySelector<HTMLButtonElement>('button[data-group]') ||
      menu.querySelector<HTMLButtonElement>('button')
    )?.focus({ preventScroll: true });
  });
  menu.addEventListener('toggle', () => trigger.setAttribute('aria-expanded', String(menu.matches(':popover-open'))));
  const cancel = () => {
    menu.hidePopover();
    trigger.focus({ preventScroll: true });
  };

  menu.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('[data-cancel]')) cancel();
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    event.preventDefault();
    event.stopPropagation();
    cancel();
  });
}

// Bulk editing targets actual equipped pieces; two-handed weapons appear once and empty sets cannot be selected.
export function renderBulkStatsEditor(app: ProfessionAppState): void {
  const host = requiredElement('gear-set-all');
  host.innerHTML = `<button type="button" class="btn btn-io" id="edit-equipment-stats" popovertarget="equipment-stats-editor" aria-haspopup="dialog" aria-expanded="false">Edit stats…</button>
    <div id="equipment-stats-editor" class="equipment-editor gear-select-menu" popover="auto" role="dialog" aria-label="Edit equipment stats"></div>`;
  const trigger = host.querySelector<HTMLButtonElement>('button')!;
  const menu = host.querySelector<HTMLElement>('[popover]')!;
  bindEditor(trigger, menu, () => {
    const b = app.build;
    const slots = GEAR_SLOTS.slice(0, 12).map((slot, index) => ({
      group: index < 6 ? 'Armor' : 'Trinkets',
      label: gearSlotLabel(slot),
      prefix: b.gear[slot],
      apply: (prefix: string) => {
        b.gear[slot] = prefix;
      }
    }));
    for (const set of [1, 2]) {
      const weapons = set === 1 ? b.weapons : b.alternateWeapons;
      const twoHanded = app.weaponData[weapons[0]]?.wielding === '2h';
      for (const slot of [0, 1]) {
        if (!weapons[slot] || (slot === 1 && twoHanded)) continue;

        slots.push({
          group: `Weapon set ${set}`,
          label: `${slot === 0 ? (twoHanded ? 'Two hand' : 'Main hand') : 'Off hand'} · ${weapons[slot]}`,
          prefix: set === 1 ? b.gear[`Weapon${slot + 1}`] : b.alternateWeaponPrefixes[slot],
          apply: (prefix: string) => {
            if (set === 1) b.gear[`Weapon${slot + 1}`] = prefix;
            else b.alternateWeaponPrefixes[slot] = prefix;
          }
        });
      }
    }

    menu.innerHTML = `<form>${editorHeading('Edit equipment stats')}
      <div class="equipment-editor-body"><section class="equipment-slot-picker" aria-label="Equipment pieces">
      <div class="equipment-quick-select" role="group" aria-label="Select pieces">${['All', 'Armor', 'Trinkets', 'Weapons', 'Clear'].map((label) => `<button type="button" class="btn btn-io" data-group="${label}">${label}</button>`).join('')}</div>
      ${['Armor', 'Trinkets', 'Weapon set 1', 'Weapon set 2'].map((group) => `<fieldset><legend>${group}</legend>${slots.map((slot, index) => (slot.group === group ? `<label class="equipment-choice"><input type="checkbox" name="slot" value="${index}"><span><span>${escapeHtml(slot.label)}</span><span class="gear-option-detail">${escapeHtml(slot.prefix)}</span></span></label>` : '')).join('')}${slots.some((slot) => slot.group === group) ? '' : '<span class="gear-option-detail">Unequipped</span>'}</fieldset>`).join('')}
      </section>${prefixChoices('bulk-prefix', '')}</div>${editorFooter()}</form>`;
    const form = menu.querySelector<HTMLFormElement>('form')!;
    const checks = [...form.querySelectorAll<HTMLInputElement>('input[name="slot"]')];
    const prefix = () => form.querySelector<HTMLInputElement>('input[name="bulk-prefix"]:checked')?.value;
    const apply = form.querySelector<HTMLButtonElement>('[data-apply]')!;
    const update = () => {
      const count = checks.filter((check) => check.checked).length;
      form.querySelector<HTMLElement>('.equipment-editor-summary')!.textContent =
        `${count} ${count === 1 ? 'piece' : 'pieces'} selected`;
      apply.disabled = !count || !prefix();
      apply.textContent = prefix()
        ? `Apply ${prefix()} to ${count} ${count === 1 ? 'piece' : 'pieces'}`
        : 'Choose stats to apply';
    };

    form.addEventListener('change', update);
    form.querySelectorAll<HTMLButtonElement>('[data-group]').forEach((button) =>
      button.addEventListener('click', () => {
        for (const check of checks) {
          const group = slots[Number(check.value)].group;
          check.checked =
            button.dataset.group === 'All' ||
            button.dataset.group === group ||
            (button.dataset.group === 'Weapons' && group.startsWith('Weapon set'));
        }

        update();
      })
    );
    bindPrefixSearch(form.querySelector<HTMLElement>('.equipment-prefix-picker')!);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = prefix();

      if (!value || apply.disabled) return;

      for (const check of checks) if (check.checked) slots[Number(check.value)].apply(value);
      menu.hidePopover();
      app.changed();
      requiredElement('edit-equipment-stats').focus({ preventScroll: true });
    });
    update();
  });
}

// Weapon and prefix choices share one draft, so changing handedness never commits a half-finished edit.
export function bindWeaponEditors(app: ProfessionAppState): void {
  document.querySelectorAll<HTMLButtonElement>('.weapon-icon-trigger').forEach((trigger) => {
    const menu = requiredElement(trigger.getAttribute('popovertarget')!);
    const set = Number(menu.dataset.set);
    const slot = Number(menu.dataset.slot);
    bindEditor(trigger, menu, () => {
      const b = app.build;
      const weapons = set === 1 ? b.weapons : b.alternateWeapons;
      let weapon = weapons[slot];
      let prefix = set === 1 ? b.gear[`Weapon${slot + 1}`] : b.alternateWeaponPrefixes[slot];
      const names = Object.entries(app.weaponData)
        .filter(([, data]) => (slot === 0 ? ['mh', 'mh+oh', '2h'] : ['oh', 'mh+oh']).includes(data.wielding))
        .map(([name]) => name);

      if (set === 2 && slot === 0) names.unshift('');

      menu.innerHTML = `<form>${editorHeading(`Weapon set ${set} · ${slot === 0 ? 'Main hand / two hand' : 'Off hand'}`)}
        <div class="equipment-editor-body"><fieldset class="equipment-weapon-picker"><legend>Weapon</legend><div class="equipment-weapon-grid">${names
          .map(
            (
              name
            ) => `<label class="equipment-choice"><input type="radio" name="weapon" value="${escapeHtml(name)}"${name === weapon ? ' checked' : ''}>
        <span>${GEAR_ICONS[name] ? `<img src="${escapeHtml(GEAR_ICONS[name])}" width="32" height="32" alt="">` : ''}<span>${escapeHtml(name || 'None')}</span></span></label>`
          )
          .join('')}</div></fieldset>
        <div class="equipment-weapon-stats"></div></div>${editorFooter()}</form>`;
      const form = menu.querySelector<HTMLFormElement>('form')!;
      const stats = form.querySelector<HTMLElement>('.equipment-weapon-stats')!;
      const summary = form.querySelector<HTMLElement>('.equipment-editor-summary')!;
      const updateSummary = () => {
        summary.textContent = weapon ? `${prefix} ${weapon}` : 'Unequip weapon set 2';
      };

      const updateStats = () => {
        stats.hidden = !weapon;
        stats.innerHTML = prefixChoices(
          'weapon-prefix',
          prefix,
          app.weaponData[weapon]?.wielding === '2h' ? 'Weapon2H' : `Weapon${slot + 1}`
        );
        bindPrefixSearch(stats.querySelector<HTMLElement>('.equipment-prefix-picker')!);
      };

      updateStats();
      updateSummary();
      form.addEventListener('change', (event) => {
        const input = event.target as HTMLInputElement;

        if (input.name === 'weapon') {
          weapon = input.value;
          updateStats();
        }

        if (input.name === 'weapon-prefix') prefix = input.value;

        updateSummary();
      });
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        weapons[slot] = weapon;

        if (slot === 0) {
          if (!weapon) {
            weapons[1] = '';
            b.startingWeaponSet = 1;
            app.attributeWeaponSet = 1;
          } else if (app.weaponData[weapon]?.wielding === '2h') weapons[1] = '';
          else if (!weapons[1]) {
            const offHands = Object.entries(app.weaponData)
              .filter(([, data]) => ['oh', 'mh+oh'].includes(data.wielding))
              .map(([name]) => name);
            weapons[1] = app.adapter.defaultOffhand({ mainHand: weapon, offHands }) || offHands[0] || '';
          }
        }

        if (set === 1) b.gear[`Weapon${slot + 1}`] = prefix;
        else b.alternateWeaponPrefixes[slot] = prefix;

        menu.hidePopover();
        app.changed();
        document
          .querySelector<HTMLButtonElement>(`.weapon-icon-trigger[popovertarget="${menu.id}"]`)
          ?.focus({ preventScroll: true });
      });
    });
  });
}
