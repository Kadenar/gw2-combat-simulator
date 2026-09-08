import { escapeHtml } from '#gw2/app/presentation/shared/html.js';

/** Ordinary selects add visible removable choices; users never need Ctrl-click or a separate upgrade lock. */
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
    <select id="optimizer-add-${key}" data-add-choice aria-label="Add ${escapeHtml(label.toLowerCase())}">
      <option value="" disabled selected>Add a choice…</option>${names.map((name, index) => `<option value="${index}" data-choice="${escapeHtml(name)}"${current.includes(name) ? ' disabled' : ''}>${escapeHtml(name ? describe(name) : 'None')}</option>`).join('')}
    </select></div>`;
}

function candidateChip(key: string, value: string, description: string): string {
  return `<span class="optimizer-choice" title="${escapeHtml(description || 'None')}"><input type="hidden" name="${key}" value="${escapeHtml(value)}"><span>${escapeHtml(value || 'None')}</span><button type="button" data-remove-choice aria-label="Remove ${escapeHtml(value || 'None')} from ${key}">×</button></span>`;
}

/** Hide selected options and enforce caps before submission while keeping every selected value visible. */
export function updatePicker(picker: HTMLElement): void {
  const values = [...picker.querySelectorAll<HTMLInputElement>('input')].map((input) => input.value);
  const limit = Number(picker.dataset.limit);
  const select = picker.querySelector<HTMLSelectElement>('select')!;
  for (const option of select.options) {
    if (option.dataset.choice !== undefined) option.disabled = values.includes(option.dataset.choice);
  }

  select.disabled = Boolean(limit && values.length >= limit);
  picker.querySelector<HTMLElement>('.optimizer-picker-empty')!.hidden = values.length > 0;
}

/** Shares add/remove interactions between gear preparation and optimizer equipment choices. */
export function bindCandidatePickers(root: HTMLElement): void {
  root.addEventListener('change', (event) => {
    const select = event.target as HTMLSelectElement;
    if (select.matches('[data-add-choice]')) {
      const option = select.selectedOptions[0];
      const picker = select.closest<HTMLElement>('[data-picker]')!;
      if (option?.dataset.choice === undefined) return;
      picker
        .querySelector('.optimizer-choices')!
        .insertAdjacentHTML(
          'beforeend',
          candidateChip(picker.dataset.picker!, option.dataset.choice, option.textContent || '')
        );
      select.value = '';
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
    select.focus();
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
