export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function gw2ApiText(value: unknown): string {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?c(?:=[^>]*)?>/gi, '');
}

interface OptionGroup {
  readonly label: string;
  readonly items: readonly string[];
}

// Select renderers escape data-derived values so panels can safely compose native option markup.
export function option(value: string, selected: string, label = value, disabled = false): string {
  return `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}${disabled ? ' disabled' : ''}>${escapeHtml(label)}</option>`;
}

export function groupedOptions(
  groups: readonly OptionGroup[],
  selected: string,
  labelFor: (value: string) => string = (value) => value,
  disabledFor: (value: string) => boolean = () => false
): string {
  return groups
    .map(
      (group) =>
        `<optgroup label="${escapeHtml(group.label)}">${group.items
          .map((item) => option(item, selected, labelFor(item), disabledFor(item)))
          .join('')}</optgroup>`
    )
    .join('');
}
