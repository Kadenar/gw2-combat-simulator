/** Match contiguous pieces of words in any order; skipped letters must not turn "bli" into "bleeding". */
export function matchesSearchWords(label: string, query: string): boolean {
  const words = label.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const terms = query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  return terms.every((term) => words.some((word) => word.includes(term)));
}

/** Share in-menu search and keyboard selection while callers retain their existing open/close and selection logic. */
export function bindDropdownSearch(
  trigger: HTMLElement,
  menu: HTMLElement,
  optionSelector: string,
  open: () => void,
  close: () => void,
  label: string
): void {
  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'dropdown-search';
  input.placeholder = 'Search…';
  input.setAttribute('aria-label', label);
  input.autocomplete = 'off';
  input.spellcheck = false;
  const empty = document.createElement('p');
  empty.className = 'dropdown-search-empty';
  empty.textContent = 'No matching choices';
  empty.setAttribute('role', 'status');
  empty.hidden = true;
  // Scroll only results so option text can never bleed through the search header's padding.
  const results = document.createElement('div');
  results.className = 'dropdown-search-results';
  results.append(...menu.childNodes, empty);
  menu.classList.add('searchable-dropdown');
  menu.append(input, results);
  const options = [...menu.querySelectorAll<HTMLElement>(optionSelector)];
  const groups = [...menu.querySelectorAll<HTMLElement>('[role="group"]')];
  options.forEach((option) => option.classList.add('dropdown-search-option'));
  groups.forEach((group) => group.classList.add('dropdown-search-group'));
  const available = () => options.filter((option) => !option.hidden && !option.matches(':disabled'));
  const filter = () => {
    for (const option of options) option.hidden = !matchesSearchWords(option.textContent || '', input.value);
    for (const group of groups) group.hidden = !group.querySelector(`${optionSelector}:not([hidden])`);
    // Disabled matches still appear in results; only an empty result list needs the no-match message.
    empty.hidden = options.some((option) => !option.hidden);
  };

  const openSearch = (focusSearch = true) => {
    input.value = '';
    open();
    filter();
    results.scrollTop = 0;
    // Touch users browse first and tap Search to type; keyboard users keep immediate search focus.
    (focusSearch ? input : trigger).focus({ preventScroll: true });
    trigger.setAttribute('aria-expanded', 'true');
  };

  const closeSearch = () => {
    close();
    trigger.setAttribute('aria-expanded', 'false');
  };

  input.addEventListener('input', filter);
  // Filtering never edits build state or submits/cancels a simulation.
  input.addEventListener('change', (event) => event.stopPropagation());
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (menu.checkVisibility()) closeSearch();
    else openSearch(event.detail === 0 || !window.matchMedia('(pointer: coarse)').matches);
  });
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeSearch();
      trigger.focus();
      return;
    }

    if (event.target === input && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      available()[0]?.click();
      return;
    }

    const navigation = ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key);
    if (event.target === input && !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const typing = event.key.length === 1 && event.key !== ' ';
    if (!navigation && !typing) return;
    event.preventDefault();
    event.stopPropagation();
    if (!menu.checkVisibility()) openSearch();
    if (typing) {
      input.value += event.key;
      filter();
      input.focus({ preventScroll: true });
      return;
    }

    const choices = available();
    const current = choices.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? choices.length - 1
          : current < 0
            ? event.key === 'ArrowDown'
              ? 0
              : choices.length - 1
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
    choices[next]?.focus();
  };

  trigger.addEventListener('keydown', onKeyDown);
  menu.addEventListener('keydown', onKeyDown);
  menu.addEventListener('focusout', (event) => {
    if (event.relatedTarget instanceof Node && !menu.contains(event.relatedTarget) && event.relatedTarget !== trigger)
      closeSearch();
  });
}
