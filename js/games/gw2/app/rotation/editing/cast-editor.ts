/** Renders profession-owned cast choices while callers retain insertion, edit guards, and command identity. */
import { formatTimelineTime, resultCombatReferenceMs } from '#gw2/app/shared/result-clock.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { CastCommand } from '#gw2/platform/builds/rotation.js';
import type { CastEditorPatch, ProfessionCastEditor } from '#gw2/platform/profession-presentation/cast-editor.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { mountFloatingEditor, type FloatingEditorHandle } from '#ui/rotation/editing/floating-editor.js';

/** Explicit active build selection prevents a displayed skill from selecting an inactive elite's editor. */
export function castEditorForSkill(app: ProfessionAppState, skill: Skill | undefined): ProfessionCastEditor | null {
  return skill
    ? app.profession.ui.castEditor(
        {
          build: app.build,
          catalog: app.activeCatalog,
          specialization: app.adapter.eliteSpecialization(app.build)
        },
        skill
      )
    : null;
}

export function openProfessionCastEditor(options: {
  readonly app: ProfessionAppState;
  readonly anchor: HTMLElement;
  readonly skill: Skill;
  readonly descriptor: ProfessionCastEditor;
  readonly insertionIndex: number;
  readonly command?: CastCommand;
  readonly onApply: (patch: CastEditorPatch) => void;
}): FloatingEditorHandle {
  const referenceMs = resultCombatReferenceMs(options.app.analysis.state.results);
  const model = options.descriptor.prepare({
    command: options.command,
    preview: (command) =>
      options.app.adapter.rotationPreviewAt(options.app, options.insertionIndex, command ? [command] : []),
    formatTime: (atMs) => formatTimelineTime(atMs, referenceMs, 3)
  });
  const editor = document.createElement('div');
  editor.className = 'rotation-cast-editor';
  editor.setAttribute('role', 'dialog');
  editor.setAttribute('aria-label', model.accessibleLabel);
  editor.tabIndex = -1;
  editor.innerHTML = `
    <div class="cast-editor-heading"></div>
    <div class="cast-editor-skill">
      <img class="cast-editor-icon" alt="" />
      <span class="cast-editor-name"></span>
    </div>
    <div class="cast-editor-label"></div>
    <div class="cast-editor-options"></div>
    <div class="cast-editor-message" aria-live="polite"></div>
    <label class="cast-editor-delay">
      <span></span>
      <input type="number" placeholder="0" />
    </label>
    <div class="cast-editor-delay-help"></div>
    <div class="cast-editor-actions">
      <button class="cast-editor-cancel" type="button">Cancel</button>
      <button class="cast-editor-apply" type="button">Apply</button>
    </div>
  `;

  const icon = editor.querySelector<HTMLImageElement>('.cast-editor-icon');
  const name = editor.querySelector<HTMLElement>('.cast-editor-name');
  const choices = editor.querySelector<HTMLElement>('.cast-editor-options');
  const message = editor.querySelector<HTMLElement>('.cast-editor-message');
  const cancel = editor.querySelector<HTMLButtonElement>('.cast-editor-cancel');
  const apply = editor.querySelector<HTMLButtonElement>('.cast-editor-apply');
  const delay = editor.querySelector<HTMLInputElement>('.cast-editor-delay input');

  if (!icon || !name || !choices || !message || !cancel || !apply || !delay) {
    throw new TypeError('Cast editor markup is incomplete.');
  }

  editor.querySelector<HTMLElement>('.cast-editor-heading')!.textContent = model.heading;
  editor.querySelector<HTMLElement>('.cast-editor-label')!.textContent = model.choiceLabel;
  editor.querySelector<HTMLElement>('.cast-editor-delay span')!.textContent = model.delay.label;
  editor.querySelector<HTMLElement>('.cast-editor-delay-help')!.textContent = model.delay.help;
  delay.min = String(model.delay.minimumMs);
  delay.step = String(model.delay.stepMs);
  icon.src = options.skill.icon || '';
  icon.hidden = !options.skill.icon;
  name.textContent = String(options.skill.displayName || options.skill.name);
  message.textContent = model.unavailableMessage || '';
  message.hidden = !model.unavailableMessage;
  delay.value = String(model.delay.valueMs);

  const addChoice = (value: string, labelText: string, checked: boolean, disabled = false, reason = ''): void => {
    const label = document.createElement('label');
    label.className = 'cast-editor-choice';
    label.classList.toggle('is-disabled', disabled);
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'cast-editor-value';
    radio.value = value;
    radio.checked = checked;
    radio.disabled = disabled;
    const text = document.createElement('span');
    text.className = 'cast-editor-choice-text';
    text.textContent = labelText;
    label.append(radio, text);

    if (reason) {
      const detail = document.createElement('span');
      detail.className = 'cast-editor-reason';
      detail.textContent = reason;
      label.append(detail);
    }

    choices.append(label);
  };

  for (const choice of model.choices) {
    addChoice(choice.id, choice.label, choice.id === model.selectedChoiceId, Boolean(choice.disabled), choice.reason);
  }

  const handle = mountFloatingEditor(editor, options.anchor);

  cancel.addEventListener('click', () => handle.close());
  apply.addEventListener('click', () => {
    const selected = editor.querySelector<HTMLInputElement>('input[name="cast-editor-value"]:checked:not(:disabled)');

    if (!selected) return;

    // Native validation checks the supplied numeric constraints; the owner validates and translates the selection.
    if (!delay.reportValidity()) return;

    const patch = model.apply(selected.value, Number(delay.value));

    if (!patch) {
      // Rejected profession selections remain editable and announce why Apply did not close the dialog.
      message.textContent = 'Unable to apply these settings. Choose an available option and a valid delay.';
      message.hidden = false;
      return;
    }

    handle.close();
    options.onApply(patch);
  });

  editor.querySelector<HTMLInputElement>('input[name="cast-editor-value"]:checked:not(:disabled)')?.focus();
  return handle;
}
