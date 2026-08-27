import { escapeHtml } from '../shared/html.js';

export interface RotationWarning {
  readonly message?: unknown;
  readonly text?: unknown;
  readonly time?: unknown;
}

export interface RotationWarningOptions {
  readonly open?: boolean;
}

export function mountRotationWarnings(
  container: HTMLElement | null | undefined,
  warnings: readonly (RotationWarning | string)[] = [],
  { open = false }: RotationWarningOptions = {}
): HTMLDetailsElement | null {
  if (!container) return null;
  const items = warnings
    .filter((warning) => warning != null)
    .map((warning) =>
      typeof warning === 'object'
        ? {
            message: String(warning.message ?? warning.text ?? ''),
            time: warning.time == null ? '' : String(warning.time)
          }
        : { message: String(warning), time: '' }
    );
  if (!items.length) {
    container.innerHTML = '';
    return null;
  }

  container.innerHTML = `<details class="rotation-warnings-wrap"${open ? ' open' : ''}>
    <summary>Warnings (${items.length})</summary>
    <ul class="rotation-warnings-content">
      ${items
        .map(
          (warning) =>
            `<li>${
              warning.time ? `<span class="rotation-warning-time">${escapeHtml(warning.time)}</span>` : ''
            }<span class="rotation-warning-message">${escapeHtml(warning.message)}</span></li>`
        )
        .join('')}
    </ul>
  </details>`;
  return container.querySelector<HTMLDetailsElement>('.rotation-warnings-wrap');
}
