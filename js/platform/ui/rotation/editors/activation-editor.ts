import type { Skill } from '../../../engine/types.js';
import { mountFloatingEditor } from './floating-editor.js';

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
  readonly minimumConcurrentOffsetMs?: number | null;
  readonly damageCommitMs?: number | null;
  readonly onApply: (timingMs: number | null) => void;
}

export interface ActivationEditorHandle {
  readonly element: HTMLElement;
  close(): void;
}

export type ActivationInterruptValidation =
  { readonly valid: true; readonly value: number } | { readonly valid: false; readonly error: string };

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

/** Accepts a whole-millisecond offset from the previous cast start, optionally including signed marker offsets. */
export function validateActivationConcurrentOffsetMs(
  rawValue: string | number,
  minimumMs: number | null = 0
): ActivationInterruptValidation {
  const parsed = Number(rawValue);
  const normalizedMinimum = minimumMs == null ? null : Math.round(Number(minimumMs) || 0);
  if (
    (typeof rawValue === 'string' && rawValue.trim() === '') ||
    !Number.isFinite(parsed) ||
    (normalizedMinimum != null && parsed < normalizedMinimum)
  ) {
    return {
      valid: false,
      error:
        normalizedMinimum == null
          ? 'Enter a finite offset in milliseconds.'
          : `Enter an offset of at least ${normalizedMinimum} ms.`
    };
  }

  return { valid: true, value: Math.round(parsed) };
}

export function openActivationEditor(options: ActivationEditorOptions): ActivationEditorHandle {
  // Instant casts edit their offset into the previous cast; cast-bar skills keep the interruption workflow.
  const behavior = options.behavior || 'interrupt';
  const isConcurrentBehavior = behavior === 'concurrent';
  const configuredMs = isConcurrentBehavior ? options.concurrentOffsetMs : options.interruptMs;
  const rawSuggestedMs = Number(
    isConcurrentBehavior ? options.suggestedConcurrentOffsetMs : options.suggestedInterruptMs
  );
  const minimumMs = isConcurrentBehavior
    ? options.minimumConcurrentOffsetMs === null
      ? null
      : Math.round(Number(options.minimumConcurrentOffsetMs) || 0)
    : 1;
  const suggestedFloor = minimumMs ?? Number.NEGATIVE_INFINITY;
  const suggestedMs = Number.isFinite(rawSuggestedMs)
    ? Math.max(suggestedFloor, Math.round(rawSuggestedMs))
    : isConcurrentBehavior
      ? Math.max(suggestedFloor, 100)
      : 1;
  const inputMinimum = minimumMs == null ? '' : ` min="${minimumMs}"`;
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
      <input class="activation-editor-input" type="number"${inputMinimum} step="1" inputmode="numeric" />
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
    configuredMs != null &&
    Number.isFinite(currentConfiguredMs) &&
    (minimumMs == null || currentConfiguredMs >= minimumMs);
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

  const handle = mountFloatingEditor(editor, options.anchor);

  const applyChanges = (): void => {
    if (normalRadio.checked) {
      handle.close();
      options.onApply(null);
      return;
    }

    const validation = isConcurrentBehavior
      ? validateActivationConcurrentOffsetMs(input.value, minimumMs)
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

  if (hasConfiguredTiming) {
    input.focus();
    input.select();
  } else {
    normalRadio.focus();
  }

  return handle;
}
