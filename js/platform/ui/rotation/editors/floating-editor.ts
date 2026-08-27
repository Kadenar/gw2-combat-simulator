const GAP = 12;
const VIEWPORT_PADDING = 8;
const ARROW_INSET = 18;

export interface FloatingEditorHandle {
  readonly element: HTMLElement;
  close(): void;
}

/** Positions a floating editor beside its anchor while keeping its panel and arrow inside the viewport. */
export function positionFloatingEditor(editor: HTMLElement, anchor: HTMLElement): boolean {
  if (!anchor.isConnected) return false;

  const anchorRect = anchor.getBoundingClientRect();
  const editorRect = editor.getBoundingClientRect();
  let left = anchorRect.right + GAP;
  const opensLeft = left + editorRect.width > window.innerWidth - VIEWPORT_PADDING;
  if (opensLeft) left = anchorRect.left - editorRect.width - GAP;

  left = Math.max(VIEWPORT_PADDING, Math.min(left, window.innerWidth - editorRect.width - VIEWPORT_PADDING));
  const anchorCenter = anchorRect.top + anchorRect.height / 2;
  const top = Math.max(
    VIEWPORT_PADDING,
    Math.min(anchorCenter - 76, window.innerHeight - editorRect.height - VIEWPORT_PADDING)
  );

  editor.classList.toggle('opens-left', opensLeft);
  editor.style.left = `${Math.round(left)}px`;
  editor.style.top = `${Math.round(top)}px`;
  editor.style.setProperty(
    '--floating-editor-arrow-y',
    `${Math.round(Math.max(ARROW_INSET, Math.min(anchorCenter - top, editorRect.height - ARROW_INSET)))}px`
  );
  return true;
}

/** Mounts one auto-dismissed editor and keeps its anchor-relative position current until it closes. */
export function mountFloatingEditor(editor: HTMLElement, anchor: HTMLElement): FloatingEditorHandle {
  const lifecycle = new AbortController();
  editor.popover = 'auto';
  editor.dataset.floatingEditor = '';
  const handle: FloatingEditorHandle = {
    element: editor,
    close(): void {
      if (editor.matches(':popover-open')) {
        editor.hidePopover();
        return;
      }

      lifecycle.abort();
      editor.remove();
    }
  };
  const reposition = (): void => {
    if (!positionFloatingEditor(editor, anchor)) handle.close();
  };

  editor.addEventListener(
    'toggle',
    (event) => {
      if ((event as ToggleEvent).newState !== 'closed') return;
      lifecycle.abort();
      editor.remove();
    },
    { signal: lifecycle.signal }
  );
  document.addEventListener('scroll', reposition, { capture: true, signal: lifecycle.signal });
  window.addEventListener('resize', reposition, { signal: lifecycle.signal });
  document.body.append(editor);
  editor.showPopover();
  reposition();
  return handle;
}

/** Closes the one floating editor allowed by the native auto-popover stack. */
export function closeFloatingEditor(): void {
  document.querySelector<HTMLElement>('[data-floating-editor]:popover-open')?.hidePopover();
}
