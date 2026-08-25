import type { Skill } from '../engine/types.js';

export interface ActivationEditorOptions {
  readonly anchor: HTMLElement;
  readonly skillName: string;
  readonly icon?: string;
  readonly behavior?: 'interrupt' | 'concurrent';
  readonly interruptMs?: number | null;
  readonly concurrentOffsetMs?: number | null;
  readonly fullCastMs?: number | null;
  readonly suggestedInterruptMs?: number | null;
  readonly suggestedConcurrentOffsetMs?: number | null;
  readonly damageCommitMs?: number | null;
  readonly onApply: (timingMs: number | null) => void;
}

export interface ActivationEditorHandle {
  readonly element: HTMLElement;
  close(): void;
}

export type ActivationInterruptValidation =
  { readonly valid: true; readonly value: number } | { readonly valid: false; readonly error: string };

let activeEditor: ActivationEditorHandle | null = null;

export function suggestedActivationInterruptMs(
  fullCastMs: number | null | undefined,
  fallbackCastMs: number | null | undefined = null
): number {
  const duration = Number(fullCastMs) || Number(fallbackCastMs) || 0;
  return Math.max(1, Math.round(duration) - 1);
}

/** Returns zero for per-packet channels or the earliest cutoff that commits a damage or condition effect. */
export function activationDamageCommitMs(
  skill: Pick<Skill, 'effects' | 'interruptCommitMs' | 'interruptMode'> | null | undefined
): number | null {
  if (!skill) return null;
  // Per-packet channels do not require a commit cutoff; each landed packet is independently valid.
  if (skill.interruptMode === 'per-packet') return 0;
  const damageEffects = (skill.effects || []).filter(
    (effect) => effect.type === 'strike' || effect.type === 'condition'
  );
  const cutoffs = damageEffects
    .map((effect) => effect.interruptCommitMs ?? skill.interruptCommitMs)
    .filter((cutoff): cutoff is number => Number.isFinite(Number(cutoff)) && Number(cutoff) >= 0)
    .map(Number);
  if (cutoffs.length) return Math.min(...cutoffs);
  const skillCutoff = Number(skill.interruptCommitMs);
  return skill.interruptCommitMs != null && Number.isFinite(skillCutoff) && skillCutoff >= 0 ? skillCutoff : null;
}

/** Keeps the configured cutoff visible so users can choose a damage-preserving interruption time up front. */
export function activationDamageCommitLabel(damageCommitMs: number | null | undefined): string {
  const cutoff = Number(damageCommitMs);
  return damageCommitMs != null && Number.isFinite(cutoff) && cutoff >= 0
    ? `Damage commit cutoff: ${cutoff} ms minimum`
    : '';
}

/** Explains when an interrupted UI activation cannot reach any declared damage commit point. */
export function activationDamageCommitWarning(
  interruptMs: string | number,
  damageCommitMs: number | null | undefined
): string {
  const cutoff = Number(damageCommitMs);
  if (damageCommitMs == null || !Number.isFinite(cutoff) || cutoff < 0) {
    return 'No damage commit time is configured. This interrupted skill will contribute no damage; configure interruptCommitMs before using interruption.';
  }

  const interrupt = Number(interruptMs);
  if (Number.isFinite(interrupt) && interrupt < cutoff) {
    return `This skill will contribute no damage before its ${cutoff} ms damage commit time. Enter at least ${cutoff} ms to use interruption.`;
  }

  return '';
}

export function validateActivationInterruptMs(
  rawValue: string | number,
  fullCastMs: number | null | undefined = null
): ActivationInterruptValidation {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return {
      valid: false,
      error: 'Enter an interruption time of at least 1 ms.'
    };
  }

  const value = Math.round(parsed);
  const fullDuration = Math.round(Number(fullCastMs) || 0);
  if (fullDuration > 0 && value >= fullDuration) {
    return {
      valid: false,
      error: `Enter a value below the full cast time of ${fullDuration} ms.`
    };
  }

  return { valid: true, value };
}

/** Accepts a whole-millisecond offset from the previous cast start, including an immediate zero offset. */
export function validateActivationConcurrentOffsetMs(rawValue: string | number): ActivationInterruptValidation {
  const parsed = Number(rawValue);
  if ((typeof rawValue === 'string' && rawValue.trim() === '') || !Number.isFinite(parsed) || parsed < 0) {
    return {
      valid: false,
      error: 'Enter an offset of at least 0 ms.'
    };
  }

  return { valid: true, value: Math.round(parsed) };
}

export function closeActivationEditor(): void {
  activeEditor?.close();
}

export function openActivationEditor(options: ActivationEditorOptions): ActivationEditorHandle {
  closeActivationEditor();

  // Instant casts edit their offset into the previous cast; cast-bar skills keep the interruption workflow.
  const behavior = options.behavior || 'interrupt';
  const isConcurrentBehavior = behavior === 'concurrent';
  const configuredMs = isConcurrentBehavior ? options.concurrentOffsetMs : options.interruptMs;
  const rawSuggestedMs = Number(
    isConcurrentBehavior ? options.suggestedConcurrentOffsetMs : options.suggestedInterruptMs
  );
  const suggestedMs = Number.isFinite(rawSuggestedMs)
    ? Math.max(isConcurrentBehavior ? 0 : 1, Math.round(rawSuggestedMs))
    : isConcurrentBehavior
      ? 100
      : 1;
  const minimumMs = isConcurrentBehavior ? 0 : 1;
  const editor = document.createElement('div');
  editor.className = 'rotation-activation-editor';
  editor.setAttribute('role', 'dialog');
  editor.setAttribute('aria-label', `Edit ${options.skillName} activation`);
  editor.tabIndex = -1;
  editor.innerHTML = `
    <div class="activation-editor-heading">Edit activation</div>
    <div class="activation-editor-skill">
      <img class="activation-editor-icon" alt="" />
      <span class="activation-editor-name"></span>
    </div>
    <div class="activation-editor-label">Cast behavior</div>
    <label class="activation-editor-choice">
      <input type="radio" name="activation-editor-mode" value="normal" />
      <span>Normal cast</span>
    </label>
    <label class="activation-editor-choice">
      <input type="radio" name="activation-editor-mode" value="${behavior}" />
      <span>${isConcurrentBehavior ? 'During previous cast' : 'Interrupt after'}</span>
    </label>
    <div class="activation-editor-input-row">
      <input class="activation-editor-input" type="number" min="${minimumMs}" step="1" inputmode="numeric" />
      <span>ms</span>
    </div>
    <div class="activation-editor-full-cast"></div>
    <div class="activation-editor-damage-commit"></div>
    <div class="activation-editor-warning" aria-live="polite" hidden></div>
    <div class="activation-editor-error" aria-live="polite"></div>
    <button class="activation-editor-reset" type="button">Reset to normal</button>
    <div class="activation-editor-actions">
      <button class="activation-editor-cancel" type="button">Cancel</button>
      <button class="activation-editor-apply" type="button">Apply</button>
    </div>
  `;

  const icon = editor.querySelector<HTMLImageElement>('.activation-editor-icon');
  const name = editor.querySelector<HTMLElement>('.activation-editor-name');
  const normalRadio = editor.querySelector<HTMLInputElement>('input[value="normal"]');
  const configuredRadio = editor.querySelector<HTMLInputElement>(`input[value="${behavior}"]`);
  const input = editor.querySelector<HTMLInputElement>('.activation-editor-input');
  const inputRow = editor.querySelector<HTMLElement>('.activation-editor-input-row');
  const fullCast = editor.querySelector<HTMLElement>('.activation-editor-full-cast');
  const damageCommit = editor.querySelector<HTMLElement>('.activation-editor-damage-commit');
  const warning = editor.querySelector<HTMLElement>('.activation-editor-warning');
  const error = editor.querySelector<HTMLElement>('.activation-editor-error');
  const reset = editor.querySelector<HTMLButtonElement>('.activation-editor-reset');
  const cancel = editor.querySelector<HTMLButtonElement>('.activation-editor-cancel');
  const apply = editor.querySelector<HTMLButtonElement>('.activation-editor-apply');

  if (
    !icon ||
    !name ||
    !normalRadio ||
    !configuredRadio ||
    !input ||
    !inputRow ||
    !fullCast ||
    !damageCommit ||
    !warning ||
    !error ||
    !reset ||
    !cancel ||
    !apply
  ) {
    throw new TypeError('Activation editor markup is incomplete.');
  }

  icon.src = options.icon || '';
  icon.hidden = !options.icon;
  name.textContent = options.skillName;

  const fullCastMs = Math.round(Number(options.fullCastMs) || 0);
  const currentConfiguredMs = Number(configuredMs);
  const hasConfiguredTiming =
    configuredMs != null && Number.isFinite(currentConfiguredMs) && currentConfiguredMs >= minimumMs;
  normalRadio.checked = !hasConfiguredTiming;
  configuredRadio.checked = hasConfiguredTiming;
  input.value = String(hasConfiguredTiming ? Math.round(currentConfiguredMs) : suggestedMs);
  if (!isConcurrentBehavior && fullCastMs > 1) input.max = String(fullCastMs - 1);
  fullCast.textContent = !isConcurrentBehavior && fullCastMs > 0 ? `Full cast: ${fullCastMs} ms` : '';
  fullCast.hidden = isConcurrentBehavior || fullCastMs <= 0;
  damageCommit.textContent = isConcurrentBehavior ? '' : activationDamageCommitLabel(options.damageCommitMs);
  damageCommit.hidden = !damageCommit.textContent;

  const updateDamageCommitWarning = (): void => {
    const message =
      !isConcurrentBehavior && configuredRadio.checked
        ? activationDamageCommitWarning(input.value, options.damageCommitMs)
        : '';
    warning.textContent = message;
    warning.hidden = !message;
  };

  const updateMode = (): void => {
    const configured = configuredRadio.checked;
    input.disabled = !configured;
    inputRow.classList.toggle('is-disabled', !configured);
    error.textContent = '';
    updateDamageCommitWarning();
  };

  normalRadio.addEventListener('change', updateMode);
  configuredRadio.addEventListener('change', () => {
    updateMode();
    if (configuredRadio.checked) {
      input.focus();
      input.select();
    }
  });
  input.addEventListener('input', () => {
    error.textContent = '';
    updateDamageCommitWarning();
  });
  updateMode();

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
  const handle: ActivationEditorHandle = {
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
    if (normalRadio.checked) {
      handle.close();
      options.onApply(null);
      return;
    }

    const validation = isConcurrentBehavior
      ? validateActivationConcurrentOffsetMs(input.value)
      : validateActivationInterruptMs(input.value, fullCastMs);
    if (!validation.valid) {
      error.textContent = validation.error;
      input.focus();
      input.select();
      return;
    }

    handle.close();
    options.onApply(validation.value);
  };

  reset.addEventListener('click', () => {
    normalRadio.checked = true;
    configuredRadio.checked = false;
    updateMode();
    normalRadio.focus();
  });
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
  if (hasConfiguredTiming) {
    input.focus();
    input.select();
  } else {
    normalRadio.focus();
  }

  return handle;
}
