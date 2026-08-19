import type { CastCommand, Skill } from '../../platform/engine/types.js';

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

let activeEditor: DoubleEdgeEditorHandle | null = null;

export function hasConfigurableDoubleEdgeOutcome(
  skill: Skill | null | undefined
): skill is ConfigurableDoubleEdgeSkill {
  return skill?.handlerId === 'thief.double-edge';
}

export function closeDoubleEdgeEditor(): void {
  activeEditor?.close();
}

export function doubleEdgeOutcomeLabel(outcome: unknown): string {
  return outcome === 'backfire' ? 'Backfired' : 'Succeeded';
}

export function openDoubleEdgeEditor(options: DoubleEdgeEditorOptions): DoubleEdgeEditorHandle {
  closeDoubleEdgeEditor();

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
  const handle: DoubleEdgeEditorHandle = {
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

  cancel.addEventListener('click', () => handle.close());
  apply.addEventListener('click', () => {
    handle.close();
    options.onApply(backfire.checked ? 'backfire' : 'success');
  });

  document.body.append(editor);
  activeEditor = handle;
  position();
  document.addEventListener('pointerdown', onOutsidePointerDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange);
  (backfire.checked ? backfire : success).focus();
  return handle;
}
