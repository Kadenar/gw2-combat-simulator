import { trackEmbeddedViewport } from '#app/embed.js';

const pendingDialogs = new WeakMap<HTMLDialogElement, () => void>();

/** Shares dismissal without treating clicks on the dialog's own padding as backdrop clicks. */
export function bindDialog(dialog: HTMLDialogElement, dismiss = (): void => dialog.close()): void {
  dialog.classList.add('app-dialog');
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    dismiss();
  });
  dialog.addEventListener('click', (event) => {
    if ((event.target as Element).closest('[data-dialog-close]')) {
      dismiss();
    } else if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      )
        dismiss();
    }
  });
}

/** Positions embedded modals before native autofocus; closing or cancelling a pending open stops tracking. */
export function showDialog(dialog: HTMLDialogElement): () => void {
  const pending = pendingDialogs.get(dialog);
  if (pending) return pending;
  if (!dialog.ownerDocument.documentElement.classList.contains('embed')) {
    if (!dialog.open) dialog.showModal();
    return () => {};
  }

  let opened = false;
  const stopTracking = trackEmbeddedViewport(dialog, {
    onVisible: () => {
      // Open once per request so viewport updates cannot reopen it before the queued close event runs.
      if (opened) return;
      opened = true;
      if (!dialog.open) dialog.showModal();
    }
  });
  const stop = (): void => {
    dialog.removeEventListener('close', stop);
    pendingDialogs.delete(dialog);
    stopTracking();
  };

  pendingDialogs.set(dialog, stop);
  dialog.addEventListener('close', stop, { once: true });
  return stop;
}
