import { escapeHtml } from '#ui/shared/html.js';

export interface RotationWarning {
  readonly message: string;
  readonly time: string;
}

export interface RotationWarningOptions {
  readonly open?: boolean;
}

/** Renders escaped warning records while preserving the caller's disclosure state. */
export function mountRotationWarnings(
  container: HTMLElement | null | undefined,
  warnings: readonly RotationWarning[] = [],
  { open = false }: RotationWarningOptions = {}
): void {
  if (!container) return;
  if (!warnings.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `<details class="rotation-warnings-wrap"${open ? ' open' : ''}>
    <summary>Warnings (${warnings.length})</summary>
    <ul class="rotation-warnings-content">
      ${warnings
        .map(
          (warning) =>
            `<li>${
              warning.time ? `<span class="rotation-warning-time">${escapeHtml(warning.time)}</span>` : ''
            }<span class="rotation-warning-message">${escapeHtml(warning.message)}</span></li>`
        )
        .join('')}
    </ul>
  </details>`;
}
