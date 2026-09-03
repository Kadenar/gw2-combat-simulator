/** Validates activation timing and mounts the rotation activation editor. */
import type { Skill } from '#gw2/platform/engine/types.js';
import { GW2_ACTION_TICK_MS } from '#gw2/platform/skills/timing.js';
import { mountFloatingEditor } from '#ui/rotation/editors/floating-editor.js';

const ACTIVATION_INTERRUPT_INTERVAL_MS = 20;

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
  readonly allowOffTarget?: boolean;
  readonly offTarget?: boolean;
  readonly onApply: (timingMs: number | null, offTarget: boolean) => void;
}

export interface ActivationEditorHandle {
  readonly element: HTMLElement;
  close(): void;
}

export type ActivationInterruptValidation =
  { readonly valid: true; readonly value: number } | { readonly valid: false; readonly error: string };

/** Suggests the latest valid GW2 action tick before the cast completes. */
export function suggestedActivationInterruptMs(
  fullCastMs: number | null | undefined,
  fallbackCastMs: number | null | undefined = null
): number {
  const duration = Number(fullCastMs) || Number(fallbackCastMs) || 0;
  return Math.max(GW2_ACTION_TICK_MS, Math.floor((Math.round(duration) - 1) / GW2_ACTION_TICK_MS) * GW2_ACTION_TICK_MS);
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

/** Accepts 20 ms interruption intervals plus exact full completion so catalog cast times remain directly usable. */
export function validateActivationInterruptMs(
  rawValue: string | number,
  fullCastMs: number | null | undefined = null
): ActivationInterruptValidation {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < ACTIVATION_INTERRUPT_INTERVAL_MS) {
    return {
      valid: false,
      error: `Enter an interruption time of at least ${ACTIVATION_INTERRUPT_INTERVAL_MS} ms.`
    };
  }

  if (!Number.isInteger(parsed)) {
    return {
      valid: false,
      error: 'Enter a whole-millisecond interruption time.'
    };
  }

  const value = parsed;
  const fullDuration = Math.round(Number(fullCastMs) || 0);
  if (value !== fullDuration && value % ACTIVATION_INTERRUPT_INTERVAL_MS !== 0) {
    return {
      valid: false,
      error: `Enter an interruption time divisible by ${ACTIVATION_INTERRUPT_INTERVAL_MS} ms.`
    };
  }

  if (fullDuration > 0 && value > fullDuration) {
    return {
      valid: false,
      error: `Enter a value no greater than the full cast time of ${fullDuration} ms.`
    };
  }

  return { valid: true, value };
}

/** Accepts action-tick offsets for skills and arbitrary whole milliseconds for signed combat-start offsets. */
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

  if (!Number.isInteger(parsed) || (normalizedMinimum != null && parsed % GW2_ACTION_TICK_MS !== 0)) {
    return {
      valid: false,
      error:
        normalizedMinimum == null
          ? 'Enter a whole-millisecond offset.'
          : `Enter an offset divisible by ${GW2_ACTION_TICK_MS} ms.`
    };
  }

  return { valid: true, value: parsed };
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
    : ACTIVATION_INTERRUPT_INTERVAL_MS;
  const inputStep = isConcurrentBehavior
    ? minimumMs == null
      ? 1
      : GW2_ACTION_TICK_MS
    : ACTIVATION_INTERRUPT_INTERVAL_MS;
  const suggestedFloor = minimumMs ?? Number.NEGATIVE_INFINITY;
  const suggestedMs = Number.isFinite(rawSuggestedMs)
    ? Math.max(suggestedFloor, Math.round(rawSuggestedMs / inputStep) * inputStep)
    : isConcurrentBehavior
      ? Math.max(suggestedFloor, 120)
      : ACTIVATION_INTERRUPT_INTERVAL_MS;
  const inputMinimum = minimumMs == null ? '' : ` min="${minimumMs}"`;
  const editor = document.createElement('div');
  editor.className = 'rotation-activation-editor';
  editor.setAttribute('role', 'dialog');
  editor.setAttribute('aria-label', `Edit ${options.skillName} activation`);
  editor.tabIndex = -1;
  // Pair context and controls on shared rows so the compact editor scans left-to-right.
  editor.innerHTML = `
    <div class="activation-editor-header">
      <div class="activation-editor-heading">Edit activation</div>
      <div class="activation-editor-skill">
        <img class="activation-editor-icon" alt="" />
        <span class="activation-editor-name"></span>
      </div>
    </div>
    <div class="activation-editor-label">Cast behavior</div>
    <label class="activation-editor-choice">
      <input type="radio" name="activation-editor-mode" value="normal" />
      <span>Normal cast</span>
    </label>
    <div class="activation-editor-configured-row">
      <label class="activation-editor-choice">
        <input type="radio" name="activation-editor-mode" value="${behavior}" />
        <span>${isConcurrentBehavior ? 'During previous cast' : 'Interrupt after'}</span>
      </label>
      <div class="activation-editor-input-row">
        <input class="activation-editor-input" type="number"${inputMinimum} step="${inputStep}" inputmode="numeric" />
        <span>ms</span>
      </div>
    </div>
    <div class="activation-editor-full-cast"></div>
    <div class="activation-editor-damage-commit"></div>
    ${
      options.allowOffTarget
        ? `<div class="activation-editor-label">Targeting</div>
    <label class="activation-editor-choice">
      <input class="activation-editor-off-target" type="checkbox" />
      <span>Cast away from target</span>
    </label>`
        : ''
    }
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
  const offTarget = editor.querySelector<HTMLInputElement>('.activation-editor-off-target');
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
    (options.allowOffTarget && !offTarget) ||
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
  if (!isConcurrentBehavior && fullCastMs > 0) input.max = String(fullCastMs);
  fullCast.textContent = !isConcurrentBehavior && fullCastMs > 0 ? `Full cast: ${fullCastMs} ms` : '';
  fullCast.hidden = isConcurrentBehavior || fullCastMs <= 0;
  damageCommit.textContent = isConcurrentBehavior ? '' : activationDamageCommitLabel(options.damageCommitMs);
  damageCommit.hidden = !damageCommit.textContent;
  if (offTarget) offTarget.checked = options.offTarget === true;

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
      options.onApply(null, offTarget?.checked === true);
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
    options.onApply(validation.value, offTarget?.checked === true);
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
