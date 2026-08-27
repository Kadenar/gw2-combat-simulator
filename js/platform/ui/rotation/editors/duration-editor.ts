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

let activeEditor: DurationEditorHandle | null = null;

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

export function closeDurationEditor(): void {
  activeEditor?.close();
}

export function openDurationEditor(options: DurationEditorOptions): DurationEditorHandle {
  closeDurationEditor();

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

  let closed = false;
  const position = (): void => {
    if (!options.anchor.isConnected) {
      handle.close();
      return;
    }

    const anchorRect = options.anchor.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    const gap = 12;
    const viewportPadding = 8;
    let opensLeft = false;
    let left = anchorRect.right + gap;

    if (left + editorRect.width > window.innerWidth - viewportPadding) {
      opensLeft = true;
      left = anchorRect.left - editorRect.width - gap;
    }

    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - editorRect.width - viewportPadding));
    const anchorCenter = anchorRect.top + anchorRect.height / 2;
    const top = Math.max(
      viewportPadding,
      Math.min(anchorCenter - 76, window.innerHeight - editorRect.height - viewportPadding)
    );
    editor.classList.toggle('opens-left', opensLeft);
    editor.style.left = `${Math.round(left)}px`;
    editor.style.top = `${Math.round(top)}px`;
    editor.style.setProperty(
      '--activation-editor-arrow-y',
      `${Math.round(Math.max(18, Math.min(anchorCenter - top, editorRect.height - 18)))}px`
    );
  };

  const onOutsidePointerDown = (event: PointerEvent): void => {
    const target = event.target;

    if (target instanceof Node && !editor.contains(target) && !options.anchor.contains(target)) {
      handle.close();
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handle.close();
    }
  };

  const onViewportChange = (): void => position();
  const handle: DurationEditorHandle = {
    element: editor,
    close(): void {
      if (closed) return;
      closed = true;
      document.removeEventListener('pointerdown', onOutsidePointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
      editor.remove();

      if (activeEditor === handle) activeEditor = null;
    }
  };

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

  document.body.append(editor);
  activeEditor = handle;
  position();
  document.addEventListener('pointerdown', onOutsidePointerDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange);
  input.focus();
  input.select();
  return handle;
}
