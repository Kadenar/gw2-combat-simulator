import { mountFloatingEditor } from './floating-editor.js';

export interface ChargeReleaseEditorRow {
  readonly charges: number;
  readonly at: number;
  readonly delta: number;
  readonly flowAfter: number | null;
  readonly coefficient: number;
  readonly disabled?: boolean;
  readonly reason?: string;
}

export interface ChargeReleaseEditorOptions {
  readonly anchor: HTMLElement;
  readonly skillName: string;
  readonly icon?: string;
  readonly currentReleaseAtCharges?: number | null;
  readonly rows: readonly ChargeReleaseEditorRow[];
  readonly unavailableMessage?: string;
  readonly onApply: (releaseAtCharges: number | undefined) => void;
}

export interface ChargeReleaseEditorHandle {
  readonly element: HTMLElement;
  close(): void;
}

function seconds(value: number): string {
  return `${value.toFixed(3)}s`;
}

export function chargeReleaseRowLabel(row: ChargeReleaseEditorRow): string {
  const flow = row.flowAfter == null ? '—' : row.flowAfter.toFixed(2);
  return (
    `${row.charges} charges · ${seconds(row.at)} (+${seconds(row.delta)}) · ` +
    `${flow} Flow · ${row.coefficient.toFixed(2)} coefficient`
  );
}

export function openChargeReleaseEditor(options: ChargeReleaseEditorOptions): ChargeReleaseEditorHandle {
  const editor = document.createElement('div');
  editor.className = 'rotation-charge-release-editor';
  editor.setAttribute('role', 'dialog');
  editor.setAttribute('aria-label', `Edit ${options.skillName} charge release`);
  editor.tabIndex = -1;
  editor.innerHTML = `
    <div class="charge-release-editor-heading">Release Dragon Slash</div>
    <div class="charge-release-editor-skill">
      <img class="charge-release-editor-icon" alt="" />
      <span class="charge-release-editor-name"></span>
    </div>
    <div class="charge-release-editor-label">Release after</div>
    <div class="charge-release-editor-options"></div>
    <div class="charge-release-editor-message" aria-live="polite"></div>
    <div class="charge-release-editor-actions">
      <button class="charge-release-editor-cancel" type="button">Cancel</button>
      <button class="charge-release-editor-apply" type="button">Apply</button>
    </div>
  `;

  const icon = editor.querySelector<HTMLImageElement>('.charge-release-editor-icon');
  const name = editor.querySelector<HTMLElement>('.charge-release-editor-name');
  const choices = editor.querySelector<HTMLElement>('.charge-release-editor-options');
  const message = editor.querySelector<HTMLElement>('.charge-release-editor-message');
  const cancel = editor.querySelector<HTMLButtonElement>('.charge-release-editor-cancel');
  const apply = editor.querySelector<HTMLButtonElement>('.charge-release-editor-apply');
  if (!icon || !name || !choices || !message || !cancel || !apply) {
    throw new TypeError('Charge release editor markup is incomplete.');
  }

  icon.src = options.icon || '';
  icon.hidden = !options.icon;
  name.textContent = options.skillName;
  message.textContent = options.unavailableMessage || '';
  message.hidden = !options.unavailableMessage;

  const current = Number(options.currentReleaseAtCharges);
  const currentAvailable = options.rows.some((row) => !row.disabled && row.charges === current);
  const addChoice = (value: string, labelText: string, checked: boolean, disabled = false, reason = ''): void => {
    const label = document.createElement('label');
    label.className = 'charge-release-editor-choice';
    label.classList.toggle('is-disabled', disabled);
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'charge-release-editor-value';
    radio.value = value;
    radio.checked = checked;
    radio.disabled = disabled;
    const text = document.createElement('span');
    text.className = 'charge-release-editor-choice-text';
    text.textContent = labelText;
    label.append(radio, text);
    if (reason) {
      const detail = document.createElement('span');
      detail.className = 'charge-release-editor-reason';
      detail.textContent = reason;
      label.append(detail);
    }

    choices.append(label);
  };

  addChoice('maximum', 'Release at maximum', options.currentReleaseAtCharges == null || !currentAvailable);
  for (const row of options.rows) {
    addChoice(
      String(row.charges),
      chargeReleaseRowLabel(row),
      currentAvailable && row.charges === current,
      Boolean(row.disabled),
      row.reason || ''
    );
  }

  const handle = mountFloatingEditor(editor, options.anchor);

  cancel.addEventListener('click', () => handle.close());
  apply.addEventListener('click', () => {
    const selected = editor.querySelector<HTMLInputElement>(
      'input[name="charge-release-editor-value"]:checked:not(:disabled)'
    );
    if (!selected) return;
    handle.close();
    options.onApply(selected.value === 'maximum' ? undefined : Number(selected.value));
  });

  editor.querySelector<HTMLInputElement>('input[name="charge-release-editor-value"]:checked:not(:disabled)')?.focus();
  return handle;
}
