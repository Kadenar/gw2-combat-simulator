/** Validates activation timing and mounts the rotation activation editor. */
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { GW2_ACTION_TICK_MS } from '#gw2/platform/skills/timing.js';
import { mountFloatingEditor, type FloatingEditorHandle } from '#ui/rotation/editing/floating-editor.js';
import type { DurationValidation } from '#ui/rotation/editing/duration-editor.js';

const DEFAULT_IMPACT_DELAY_MS = 1000;

/** How a precast's hostile packets reach the target: normally, later by a travel delay, or not at all. */
export interface ActivationTargeting {
  readonly offTarget: boolean;
  readonly impactDelayMs: number | null;
}

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
  readonly targetImpactDetails?: string;
  /** Scheduled cast-relative impact times, including any saved delay, so targeting edits can preview new landings. */
  readonly impactOffsetsMs?: readonly number[] | null;
  /** Milliseconds from this cast's start to Combat Start, for showing whether a precast lands after the marker. */
  readonly combatStartAfterCastMs?: number | null;
  readonly allowTargeting?: boolean;
  readonly offTarget?: boolean;
  readonly impactDelayMs?: number | null;
  readonly onApply: (timingMs: number | null, targeting: ActivationTargeting) => void;
}

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

/** Requires action-tick interruption times so manual edits match the scheduler's timing grid. */
export function validateActivationInterruptMs(
  rawValue: string | number,
  fullCastMs: number | null | undefined = null
): DurationValidation {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < GW2_ACTION_TICK_MS) {
    return {
      valid: false,
      error: `Enter an interruption time of at least ${GW2_ACTION_TICK_MS} ms.`
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
  if (value % GW2_ACTION_TICK_MS !== 0) {
    return {
      valid: false,
      error: `Enter an interruption time divisible by ${GW2_ACTION_TICK_MS} ms.`
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

/** Requires action-tick offsets, including signed offsets that position Combat Start. */
export function validateActivationConcurrentOffsetMs(
  rawValue: string | number,
  minimumMs: number | null = 0
): DurationValidation {
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

  if (!Number.isInteger(parsed) || parsed % GW2_ACTION_TICK_MS !== 0) {
    return {
      valid: false,
      error: `Enter an offset divisible by ${GW2_ACTION_TICK_MS} ms.`
    };
  }

  return { valid: true, value: parsed };
}

/**
 * Describes where a precast's hits land relative to Combat Start. Only hits before the marker are discarded, so the
 * text counts them instead of implying the whole cast is lost when later pulses still land.
 */
export function activationCombatStartRelation(
  impactOffsetsMs: readonly number[],
  combatStartAfterCastMs: number
): { readonly text: string; readonly missedHits: number } {
  const totalHits = impactOffsetsMs.length;
  const firstHitMs = impactOffsetsMs[0] ?? 0;
  const missedHits = impactOffsetsMs.filter((offset) => offset < combatStartAfterCastMs).length;
  if (missedHits === 0) {
    return { text: `Lands ${firstHitMs - combatStartAfterCastMs} ms after Combat Start`, missedHits };
  }

  const earlyMs = combatStartAfterCastMs - firstHitMs;
  if (missedHits === totalHits) {
    const missed = totalHits === 1 ? 'its hit' : `all ${totalHits} hits`;
    return { text: `Lands ${earlyMs} ms before Combat Start, so ${missed} will be missed`, missedHits };
  }

  return {
    text: `First hit lands ${earlyMs} ms before Combat Start, so ${missedHits} of ${totalHits} hits will be missed`,
    missedHits
  };
}

/** Accepts any positive whole-millisecond travel delay; landing time is not bound to the action tick. */
export function validateActivationImpactDelayMs(rawValue: string | number): DurationValidation {
  const parsed = Number(rawValue);
  if ((typeof rawValue === 'string' && rawValue.trim() === '') || !Number.isFinite(parsed) || parsed < 1) {
    return { valid: false, error: 'Enter an impact delay of at least 1 ms.' };
  }

  if (!Number.isInteger(parsed)) {
    return { valid: false, error: 'Enter a whole-millisecond impact delay.' };
  }

  return { valid: true, value: parsed };
}

export function openActivationEditor(options: ActivationEditorOptions): FloatingEditorHandle {
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
      : Math.ceil((Number(options.minimumConcurrentOffsetMs) || 0) / GW2_ACTION_TICK_MS) * GW2_ACTION_TICK_MS
    : GW2_ACTION_TICK_MS;
  // Native number stepping snaps off-grid values in either direction; align its minimum to the same tick grid.
  const inputStep = GW2_ACTION_TICK_MS;
  const suggestedFloor = minimumMs ?? Number.NEGATIVE_INFINITY;
  const suggestedMs = Number.isFinite(rawSuggestedMs)
    ? Math.max(suggestedFloor, Math.round(rawSuggestedMs / inputStep) * inputStep)
    : isConcurrentBehavior
      ? Math.max(suggestedFloor, 120)
      : GW2_ACTION_TICK_MS;
  const inputMinimum = minimumMs == null ? '' : ` min="${minimumMs}"`;
  const editor = document.createElement('div');
  editor.className = 'rotation-activation-editor';
  editor.setAttribute('role', 'dialog');
  editor.setAttribute('aria-label', `Edit ${options.skillName} activation`);
  editor.tabIndex = -1;
  // Landing details describe the outcome of targeting, so precasts show them inside the Target section.
  const impactMarkup = `<div class="activation-editor-target-impact"></div>
    <div class="activation-editor-combat-relation" hidden></div>`;
  // Pair context and controls on shared rows so the compact editor scans left-to-right.
  editor.innerHTML = `
    <div class="activation-editor-header">
      <div class="activation-editor-heading">Edit activation</div>
      <div class="activation-editor-skill">
        <img class="activation-editor-icon" alt="" />
        <span class="activation-editor-name"></span>
      </div>
    </div>
    <div class="activation-editor-label">Cast timing</div>
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
      options.allowTargeting
        ? `<div class="activation-editor-targeting">
      <div class="activation-editor-label">Target</div>
      <select class="activation-editor-select activation-editor-targeting-mode" aria-label="Target">
        <option value="on-target">Hits the target</option>
        <option value="delayed">Hits the target after a delay</option>
        <option value="off-target">Misses (cast away from target)</option>
      </select>
      <div class="activation-editor-input-row activation-editor-impact-delay-row">
        <span>Delay</span>
        <input class="activation-editor-input activation-editor-impact-delay" type="number" min="1" step="20" inputmode="numeric" aria-label="Impact delay in milliseconds" />
        <span>ms</span>
      </div>
      ${impactMarkup}
    </div>`
        : impactMarkup
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
  const targetImpact = editor.querySelector<HTMLElement>('.activation-editor-target-impact');
  const combatRelation = editor.querySelector<HTMLElement>('.activation-editor-combat-relation');
  const targetingMode = editor.querySelector<HTMLSelectElement>('.activation-editor-targeting-mode');
  const impactDelayInput = editor.querySelector<HTMLInputElement>('.activation-editor-impact-delay');
  const impactDelayRow = editor.querySelector<HTMLElement>('.activation-editor-impact-delay-row');
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
    !targetImpact ||
    !combatRelation ||
    (options.allowTargeting && (!targetingMode || !impactDelayInput || !impactDelayRow)) ||
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
  // Off-target and delayed impact are exclusive: a cast either lands normally, lands late, or never lands.
  const savedImpactDelayMs =
    options.offTarget === true ? 0 : Math.max(0, Math.round(Number(options.impactDelayMs) || 0));
  // The scheduled first hit already includes the saved delay; removing it lets the editor preview any new delay.
  const baseImpactOffsetsMs = options.impactOffsetsMs?.length
    ? options.impactOffsetsMs.map((offset) => Math.round(offset) - savedImpactDelayMs)
    : null;
  if (targetingMode && impactDelayInput) {
    targetingMode.value = options.offTarget === true ? 'off-target' : savedImpactDelayMs > 0 ? 'delayed' : 'on-target';
    impactDelayInput.value = String(savedImpactDelayMs > 0 ? savedImpactDelayMs : DEFAULT_IMPACT_DELAY_MS);
  }

  const selectedTargeting = (): string => targetingMode?.value ?? 'on-target';
  const previewImpactDelayMs = (): number => {
    if (selectedTargeting() !== 'delayed' || !impactDelayInput) return 0;
    const validation = validateActivationImpactDelayMs(impactDelayInput.value);
    return validation.valid ? validation.value : 0;
  };

  // Recompute the landing preview on every targeting edit; simulated results only refresh after Apply.
  const updateImpactPreview = (): void => {
    combatRelation.hidden = true;
    combatRelation.classList.remove('is-ignored');
    if (baseImpactOffsetsMs == null) {
      targetImpact.textContent = options.targetImpactDetails || '';
    } else if (selectedTargeting() === 'off-target') {
      targetImpact.textContent = 'No hits reach the target.';
    } else {
      const delayMs = previewImpactDelayMs();
      const impactOffsetsMs = baseImpactOffsetsMs.map((offset) => offset + delayMs);
      targetImpact.textContent = `First hit: ${impactOffsetsMs[0]} ms`;
      // Hits before Combat Start are discarded, so precasts show which side of the marker they land on.
      if (options.combatStartAfterCastMs != null) {
        const relation = activationCombatStartRelation(impactOffsetsMs, Math.round(options.combatStartAfterCastMs));
        combatRelation.textContent = relation.text;
        combatRelation.classList.toggle('is-ignored', relation.missedHits > 0);
        combatRelation.hidden = false;
      }
    }

    targetImpact.hidden = !targetImpact.textContent;
  };

  const updateTargeting = (): void => {
    if (impactDelayRow) impactDelayRow.hidden = selectedTargeting() !== 'delayed';
    error.textContent = '';
    updateImpactPreview();
  };

  targetingMode?.addEventListener('change', () => {
    updateTargeting();
    if (selectedTargeting() === 'delayed') {
      impactDelayInput?.focus();
      impactDelayInput?.select();
    }
  });
  impactDelayInput?.addEventListener('input', () => {
    error.textContent = '';
    updateImpactPreview();
  });
  updateTargeting();

  // Returns null after reporting an invalid delay so the editor stays open for correction.
  const readTargeting = (): ActivationTargeting | null => {
    if (selectedTargeting() !== 'delayed' || !impactDelayInput) {
      return { offTarget: selectedTargeting() === 'off-target', impactDelayMs: null };
    }

    const validation = validateActivationImpactDelayMs(impactDelayInput.value);
    if (!validation.valid) {
      error.textContent = validation.error;
      impactDelayInput.focus();
      impactDelayInput.select();
      return null;
    }

    return { offTarget: false, impactDelayMs: validation.value };
  };

  const updateDamageCommitWarning = (): void => {
    // Show interruption guidance only while the user is configuring an interruption.
    damageCommit.hidden = isConcurrentBehavior || !configuredRadio.checked || !damageCommit.textContent;
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
    const targeting = readTargeting();
    if (!targeting) return;
    if (normalRadio.checked) {
      handle.close();
      options.onApply(null, targeting);
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
    options.onApply(validation.value, targeting);
  };

  reset.addEventListener('click', () => {
    normalRadio.checked = true;
    configuredRadio.checked = false;
    updateMode();
    normalRadio.focus();
  });
  cancel.addEventListener('click', () => handle.close());
  apply.addEventListener('click', applyChanges);
  for (const field of [input, impactDelayInput]) {
    field?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyChanges();
      }
    });
  }

  if (hasConfiguredTiming) {
    input.focus();
    input.select();
  } else {
    normalRadio.focus();
  }

  return handle;
}
