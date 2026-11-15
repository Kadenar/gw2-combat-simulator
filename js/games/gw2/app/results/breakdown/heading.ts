/** Share compact, named metric headings between loading placeholders and sortable results. */
import type { ResultColumn } from '#gw2/app/results/breakdown/model.js';
import { escapeHtml } from '#ui/shared/html.js';

export function resultColumnHeadingHtml(
  column: ResultColumn,
  options: { sortable?: boolean; indicator?: string } = {}
): string {
  const label = escapeHtml(column.label || column.key);
  const content = column.icon
    ? `<img class="res-column-icon" src="${escapeHtml(column.icon)}" width="14" height="14" alt="" />`
    : label;
  const name = column.icon ? ` aria-label="${label}" title="${label}"` : '';
  return options.sortable
    ? `<button type="button" data-sort-col="${escapeHtml(column.key)}"${name}>${content}${escapeHtml(options.indicator || '')}</button>`
    : `<span${column.icon ? ' role="img"' : ''}${name}>${content}</span>`;
}
