import { mountFloatingEditor } from './floating-editor.js';

export interface DurationEditorOptions {
  readonly anchor: HTMLElement;
  readonly heading: string;
  readonly name: string;
  readonly icon?: string;
  readonly label: string;
  readonly value: number;
  readonly minimumMs?: number;
  readonly maximumMs?: number | null;
  readonly onApply: (durationMs: number) => void;
}

export interface DurationEditorHandle {
  readonly element: HTMLElement;
  close(): void;
}

export type DurationValidation =
  { readonly valid: true; readonly value: number } | { readonly valid: false; readonly error: string };

export function validateDurationMs(
  rawValue: string | number,
  minimumMs = 1,
  maximumMs: number | null = null
): DurationValidation {
  const parsed = Number(rawValue);
  const minimum = Math.max(1, Math.round(Number(minimumMs) || 1));
  if (!Number.isFinite(parsed) || parsed < minimum) {
    return {
      valid: false,
      error: `Enter a duration of at least ${minimum} ms.`
    };
  }

  const value = Math.round(parsed);
  const maximum = Math.round(Number(maximumMs));
  if (maximumMs != null && Number.isFinite(maximum) && value > maximum) {
    return {
      valid: false,
      error: `Enter a duration no greater than ${maximum} ms.`
    };
  }

  return { valid: true, value };
}

export function openDurationEditor(options: DurationEditorOptions): DurationEditorHandle {
  const editor = document.createElement('div');
  editor.className = 'rotation-activation-editor rotation-duration-editor';
  editor.setAttribute('role', 'dialog');
  editor.setAttribute('aria-label', options.heading);
  editor.tabIndex = -1;
  editor.innerHTML = `
    <div class="activation-editor-heading"></div>
    <div class="activation-editor-skill">
      <img class="activation-editor-icon" alt="" />
      <span class="activation-editor-name"></span>
    </div>
    <label class="activation-editor-label" for="rotation-duration-editor-input"></label>
    <div class="activation-editor-input-row">
      <input id="rotation-duration-editor-input" class="activation-editor-input" type="number" step="1" inputmode="numeric" />
      <span>ms</span>
    </div>
    <div class="activation-editor-error" aria-live="polite"></div>
    <div class="activation-editor-actions">
      <button class="activation-editor-cancel" type="button">Cancel</button>
      <button class="activation-editor-apply" type="button">Apply</button>
    </div>
  `;

  const heading = editor.querySelector<HTMLElement>('.activation-editor-heading');
  const icon = editor.querySelector<HTMLImageElement>('.activation-editor-icon');
  const name = editor.querySelector<HTMLElement>('.activation-editor-name');
  const label = editor.querySelector<HTMLLabelElement>('.activation-editor-label');
  const input = editor.querySelector<HTMLInputElement>('.activation-editor-input');
  const error = editor.querySelector<HTMLElement>('.activation-editor-error');
  const cancel = editor.querySelector<HTMLButtonElement>('.activation-editor-cancel');
  const apply = editor.querySelector<HTMLButtonElement>('.activation-editor-apply');
  if (!heading || !icon || !name || !label || !input || !error || !cancel || !apply) {
    throw new TypeError('Duration editor markup is incomplete.');
  }

  heading.textContent = options.heading;
  icon.src = options.icon || '';
  icon.hidden = !options.icon;
  name.textContent = options.name;
  label.textContent = options.label;
  input.value = String(Math.round(Number(options.value) || 0));
  input.min = String(Math.max(1, Math.round(Number(options.minimumMs) || 1)));
  const maximum = Math.round(Number(options.maximumMs));
  if (options.maximumMs != null && Number.isFinite(maximum)) {
    input.max = String(maximum);
  }

  input.addEventListener('input', () => {
    error.textContent = '';
  });

  const handle = mountFloatingEditor(editor, options.anchor);

  const applyChanges = (): void => {
    const validation = validateDurationMs(input.value, options.minimumMs, options.maximumMs);
    if (!validation.valid) {
      error.textContent = validation.error;
      input.focus();
      input.select();
      return;
    }

    handle.close();
    options.onApply(validation.value);
  };

  cancel.addEventListener('click', () => handle.close());
  apply.addEventListener('click', applyChanges);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyChanges();
    }
  });

  input.focus();
  input.select();
  return handle;
}
