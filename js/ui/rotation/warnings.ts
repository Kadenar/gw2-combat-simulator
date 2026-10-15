import { escapeHtml } from '#ui/shared/html.js';

export interface RotationWarning {
  readonly message: string;
  readonly time: string;
  readonly action?: {
    readonly label: string;
    readonly activate: () => void;
  };
}

export interface RotationWarningOptions {
  readonly open?: boolean;
}

/** Makes located warnings keyboard-accessible actions while keeping unlocated diagnostics readable. */
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
          (warning, index) =>
            `<li>${warning.action ? `<button type="button" class="rotation-warning-link" data-warning-index="${index}" title="${escapeHtml(warning.action.label)}">` : ''}${
              warning.time ? `<span class="rotation-warning-time">${escapeHtml(warning.time)}</span>` : ''
            }<span class="rotation-warning-message">${escapeHtml(warning.message)}</span>${warning.action ? `<span class="rotation-warning-action">${escapeHtml(warning.action.label)} &rarr;</span></button>` : ''}</li>`
        )
        .join('')}
    </ul>
  </details>`;
  container.querySelectorAll<HTMLButtonElement>('[data-warning-index]').forEach((button) => {
    button.addEventListener('click', () => warnings[Number(button.dataset.warningIndex)]?.action?.activate());
  });
}
