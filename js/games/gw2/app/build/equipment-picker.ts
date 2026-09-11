import { bindDropdownSearch } from '#ui/shared/dropdown-search.js';
import { escapeHtml } from '#gw2/app/presentation/shared/html.js';

/** Searchable selects add visible removable choices without requiring Ctrl-click. */
export function candidatePicker(
  key: string,
  label: string,
  names: readonly string[],
  current: readonly string[] = [],
  limit = 0,
  describe: (name: string) => string = (name) => name,
  emptyLabel = 'Keep current equipment'
): string {
  // Section legends supply context visually; keep the full label on the select for accessible identification.
  const displayLabel =
    key === 'prefixes' || key === 'infusionStats' ? '' : key.startsWith('sigil') ? `Sigil ${key.at(-1)}` : label;
  return `<div class="optimizer-picker" data-picker="${key}" data-limit="${limit}">
    <div class="optimizer-picker-heading">${displayLabel ? `<label for="optimizer-add-${key}">${escapeHtml(displayLabel)}</label>` : ''}${limit ? `<span>Up to ${limit}</span>` : ''}</div>
    <div class="optimizer-choices">${current.map((name) => candidateChip(key, name, describe(name))).join('')}</div>
    <p class="optimizer-picker-empty" title="${escapeHtml(emptyLabel)}">${escapeHtml(emptyLabel)}</p>
    <div class="gear-select-display"><select class="gear-select" id="optimizer-add-${key}" data-add-choice aria-label="Add ${escapeHtml(label.toLowerCase())}">
      <option value="" disabled selected>Add a choice…</option>${names.map((name, index) => `<option value="${index}" data-choice="${escapeHtml(name)}"${current.includes(name) ? ' disabled' : ''}>${escapeHtml(name ? describe(name) : 'None')}</option>`).join('')}
    </select><button type="button" class="gear-select-trigger" aria-label="Add ${escapeHtml(label.toLowerCase())}">Add a choice…</button></div></div>`;
}

function candidateChip(key: string, value: string, description: string): string {
  return `<span class="optimizer-choice" title="${escapeHtml(description || 'None')}"><input type="hidden" name="${key}" value="${escapeHtml(value)}"><span>${escapeHtml(value || 'None')}</span><button type="button" data-remove-choice aria-label="Remove ${escapeHtml(value || 'None')} from ${key}">×</button></span>`;
}

/** Filter descriptions and enforce caps using only selected chips, never the search field's text. */
export function updatePicker(picker: HTMLElement): void {
  const values = [...picker.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map((input) => input.value);
  const limit = Number(picker.dataset.limit);
  const select = picker.querySelector<HTMLSelectElement>('select')!;
  enhanceDetailedSelect(select, select.id);
  for (const option of select.options) {
    if (option.dataset.choice === undefined) continue;
    option.disabled = values.includes(option.dataset.choice);
  }

  select.disabled = Boolean(limit && values.length >= limit);
  picker.querySelector<HTMLButtonElement>('.gear-select-trigger')!.disabled = select.disabled;
  // Keep the visible popover consistent with the underlying equipment values.
  for (const choice of picker.querySelectorAll<HTMLButtonElement>('.gear-select-option')) {
    const option = [...select.options].find((option) => option.value === choice.dataset.value);
    choice.disabled = !option || option.disabled || select.disabled;
  }

  picker.querySelector<HTMLInputElement>('.dropdown-search')!.dispatchEvent(new Event('input'));
  picker.querySelector<HTMLElement>('.optimizer-picker-empty')!.hidden = values.length > 0;
}

/** Shares add/remove interactions between gear preparation and optimizer equipment choices. */
export function bindCandidatePickers(root: HTMLElement): void {
  root.addEventListener('change', (event) => {
    const select = event.target as HTMLSelectElement;
    if (select.matches('[data-add-choice]')) {
      const option = select.selectedOptions[0];
      const picker = select.closest<HTMLElement>('[data-picker]')!;
      if (option?.dataset.choice === undefined || option.disabled || select.disabled) return;
      picker
        .querySelector('.optimizer-choices')!
        .insertAdjacentHTML(
          'beforeend',
          candidateChip(picker.dataset.picker!, option.dataset.choice, option.textContent || '')
        );
      select.value = '';
      picker.querySelector<HTMLInputElement>('.dropdown-search')!.value = '';
      updatePicker(picker);
    }
  });
  root.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest('[data-remove-choice]');
    if (!button) return;
    const picker = button.closest<HTMLElement>('[data-picker]')!;
    const select = picker.querySelector<HTMLSelectElement>('select')!;
    button.closest('.optimizer-choice')!.remove();
    updatePicker(picker);
    picker.querySelector<HTMLButtonElement>('.gear-select-trigger')!.focus();
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

// Keep icon pickers within the viewport, including when the equipment column is near its edge.
export function positionGearPopover(menu: HTMLElement, trigger: HTMLElement): void {
  const anchor = trigger.getBoundingClientRect();
  const bounds = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - bounds.width - 8))}px`;
  menu.style.top = `${anchor.bottom + bounds.height + 2 <= window.innerHeight ? anchor.bottom + 2 : Math.max(8, anchor.top - bounds.height - 2)}px`;
}

function splitOptionLabel(label: string): { name: string; details: string } {
  const separator = ' \u2014 ';
  const separatorIndex = label.indexOf(separator);
  return separatorIndex < 0
    ? { name: label, details: '' }
    : { name: label.slice(0, separatorIndex), details: label.slice(separatorIndex + separator.length) };
}

// Upgrade detailed native selects into styled popovers while preserving their existing change handlers and values.
export function enhanceDetailedSelect(select: HTMLSelectElement, index: number | string): void {
  // Native weapon and infusion selects can use the same menu as the existing icon controls.
  if (!select.parentElement?.classList.contains('gear-select-display')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'gear-select-display';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gear-select-trigger';
    button.textContent = select.selectedOptions[0]?.textContent || 'Choose…';
    select.before(wrapper);
    wrapper.append(select, button);
  }

  const display = select.parentElement;
  const trigger = display?.querySelector('.gear-select-trigger');
  if (!(display instanceof HTMLElement) || !(trigger instanceof HTMLButtonElement)) return;
  if (display.querySelector('.gear-select-menu')) return;

  const menu = document.createElement('div');
  const menuId = `gear-select-menu-${index}`;
  menu.id = menuId;
  menu.className = 'gear-select-menu';
  menu.setAttribute('popover', 'auto');
  const list = document.createElement('div');
  list.id = `${menuId}-options`;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', select.getAttribute('aria-label') || 'Equipment options');
  menu.append(list);
  trigger.setAttribute('popovertarget', menuId);
  trigger.setAttribute('aria-label', select.getAttribute('aria-label') || 'Equipment options');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.disabled = select.disabled;
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  const addOption = (optionElement: HTMLOptionElement, parent: HTMLElement): void => {
    if (select.matches('[data-add-choice]') && optionElement.value === '') return;
    const { name, details } = splitOptionLabel(optionElement.textContent);
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'gear-select-option';
    choice.dataset.value = optionElement.value;
    choice.disabled = optionElement.matches(':disabled');
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
      if (!trigger.classList.contains('gear-icon-trigger'))
        trigger.textContent = select.matches('[data-add-choice]') ? 'Add a choice…' : name;
      menu.querySelectorAll('[role="option"]').forEach((item) => {
        item.setAttribute('aria-selected', String(item === choice));
      });
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const current = select.id ? document.getElementById(select.id) : select;
      (current?.parentElement?.querySelector('.gear-select-trigger') as HTMLButtonElement | null)?.focus();
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

      list.append(group);
    } else if (child instanceof HTMLOptionElement) {
      addOption(child, list);
    }
  }

  // Refresh disabled choices before opening without changing the underlying selected value.
  const openMenu = (): void => {
    // Shared multi-choice pickers disable selected entries as chips are added or removed.
    for (const choice of menu.querySelectorAll<HTMLButtonElement>('.gear-select-option')) {
      const option = [...select.options].find((option) => option.value === choice.dataset.value);
      choice.disabled = !option || option.matches(':disabled');
      choice.setAttribute('aria-selected', String(option?.selected || false));
    }

    menu.showPopover();
    positionGearPopover(menu, trigger);
  };

  bindDropdownSearch(
    trigger,
    menu,
    '.gear-select-option',
    openMenu,
    () => menu.hidePopover(),
    `Search ${(select.getAttribute('aria-label') || 'equipment').replace(/^Add /, '')}`
  );

  menu.addEventListener('toggle', () => {
    const isOpen = menu.matches(':popover-open');
    trigger.setAttribute('aria-expanded', String(isOpen));
    display.classList.toggle('is-open', isOpen);
  });

  select.addEventListener('change', () => {
    if (select.matches('[data-add-choice]')) return;
    const name = splitOptionLabel(select.selectedOptions[0]?.textContent || select.value).name;
    const caption = display.closest('.gear-icon-row')?.querySelector('.gear-equipped-name');
    if (caption) caption.textContent = name;
    trigger.title = name;
  });
  display.append(menu);
}
