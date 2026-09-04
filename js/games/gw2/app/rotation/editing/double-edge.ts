import type { CastCommand } from '#gw2/platform/engine/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { mountFloatingEditor } from '#ui/rotation/editors/floating-editor.js';

/**
 * Popover editor for a thief Double Edge cast, letting the author pin the risky
 * recast to either outcome (succeeded / backfired) so the sim is deterministic.
 * Only one editor is open at a time; opening a new one closes the previous.
 */

export type DoubleEdgeOutcome = NonNullable<CastCommand['doubleEdgeOutcome']>;

export interface DoubleEdgeEditorOptions {
  readonly anchor: HTMLElement;
  readonly skillName: string;
  readonly icon?: string;
  readonly outcome?: DoubleEdgeOutcome | null;
  readonly onApply: (outcome: DoubleEdgeOutcome) => void;
}

export interface DoubleEdgeEditorHandle {
  readonly element: HTMLElement;
  close(): void;
}

export type ConfigurableDoubleEdgeSkill = Skill & {
  readonly handlerId: 'thief.double-edge';
};

/** Type guard: true for skills whose Double Edge outcome is author-configurable. */
export function hasConfigurableDoubleEdgeOutcome(
  skill: Skill | null | undefined
): skill is ConfigurableDoubleEdgeSkill {
  return skill?.handlerId === 'thief.double-edge';
}

/** Human-readable label for a stored outcome value. */
export function doubleEdgeOutcomeLabel(outcome: unknown): string {
  return outcome === 'backfire' ? 'Backfired' : 'Succeeded';
}

/**
 * Builds and mounts the Double Edge popover while native dismissal owns its lifecycle.
 */
export function openDoubleEdgeEditor(options: DoubleEdgeEditorOptions): DoubleEdgeEditorHandle {
  const editor = document.createElement('div');
  editor.className = 'rotation-activation-editor rotation-double-edge-editor';
  editor.setAttribute('role', 'dialog');
  editor.setAttribute('aria-label', `Edit ${options.skillName} outcome`);
  editor.tabIndex = -1;
  editor.innerHTML = `
    <div class="activation-editor-heading">Resolve Double Edge</div>
    <div class="activation-editor-skill">
      <img class="activation-editor-icon" alt="" />
      <span class="activation-editor-name"></span>
    </div>
    <div class="activation-editor-label">Risky recast outcome</div>
    <label class="activation-editor-choice">
      <input type="radio" name="double-edge-editor-outcome" value="success" />
      <span>Succeeded</span>
    </label>
    <label class="activation-editor-choice">
      <input type="radio" name="double-edge-editor-outcome" value="backfire" />
      <span>Backfired</span>
    </label>
    <div class="activation-editor-actions">
      <button class="activation-editor-cancel" type="button">Cancel</button>
      <button class="activation-editor-apply" type="button">Apply</button>
    </div>
  `;

  const icon = editor.querySelector<HTMLImageElement>('.activation-editor-icon');
  const name = editor.querySelector<HTMLElement>('.activation-editor-name');
  const cancel = editor.querySelector<HTMLButtonElement>('.activation-editor-cancel');
  const apply = editor.querySelector<HTMLButtonElement>('.activation-editor-apply');
  const success = editor.querySelector<HTMLInputElement>('input[value="success"]');
  const backfire = editor.querySelector<HTMLInputElement>('input[value="backfire"]');
  if (!icon || !name || !cancel || !apply || !success || !backfire) {
    throw new TypeError('Double Edge editor markup is incomplete.');
  }

  icon.src = options.icon || '';
  icon.hidden = !options.icon;
  name.textContent = options.skillName;
  backfire.checked = options.outcome === 'backfire';
  success.checked = !backfire.checked;

  const handle = mountFloatingEditor(editor, options.anchor);

  cancel.addEventListener('click', () => handle.close());
  apply.addEventListener('click', () => {
    handle.close();
    options.onApply(backfire.checked ? 'backfire' : 'success');
  });

  (backfire.checked ? backfire : success).focus();
  return handle;
}
