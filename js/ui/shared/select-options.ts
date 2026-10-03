import { escapeHtml } from '#ui/shared/html.js';

interface OptionGroup {
  readonly label: string;
  readonly items: readonly string[];
}

// Select renderers escape data-derived values so panels can safely compose native option markup.
export function optionHtml(value: string, selected: string, label = value, disabled = false): string {
  return `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}${disabled ? ' disabled' : ''}>${escapeHtml(label)}</option>`;
}

export function groupedOptionsHtml(
  groups: readonly OptionGroup[],
  selected: string,
  labelFor: (value: string) => string = (value) => value,
  disabledFor: (value: string) => boolean = () => false
): string {
  return groups
    .map(
      (group) =>
        `<optgroup label="${escapeHtml(group.label)}">${group.items
          .map((item) => optionHtml(item, selected, labelFor(item), disabledFor(item)))
          .join('')}</optgroup>`
    )
    .join('');
}
