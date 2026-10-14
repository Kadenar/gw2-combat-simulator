import { inputBindingForKey, inputKeyModifier, inputMouseButtonCode } from '#gw2/input/bindings.js';

/** Shared capture preserves ordinary Tab navigation; Enter arms capture when Tab itself is the binding. */
export function bindInputCapture(input: HTMLInputElement, commit: (binding: string) => void): void {
  let pendingModifier: string | null = null;
  let armed = false;
  const pressed = new Set<string>();
  const reset = (): void => {
    pendingModifier = null;
    armed = false;
    delete input.dataset.capturing;
  };

  const save = (binding: string | null): void => {
    if (binding != null) commit(binding);
    reset();
  };

  input.addEventListener('blur', () => {
    pressed.clear();
    reset();
  });
  input.addEventListener('keydown', (event) => {
    pressed.add(event.code);
    if (event.isComposing || event.metaKey) {
      reset();
      return;
    }

    // Ordinary Escape belongs to the dialog; only an explicitly armed capture consumes it.
    if ((event.code === 'Tab' || event.code === 'Escape') && !armed) {
      reset();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    if (event.code === 'Escape') {
      reset();
      return;
    }

    if (event.code === 'Enter' && !armed) {
      armed = true;
      input.dataset.capturing = 'true';
      pendingModifier = null;
      return;
    }

    if (inputKeyModifier(event.code)) {
      const held = [event.ctrlKey, event.altKey, event.shiftKey].filter(Boolean).length;
      pendingModifier = held === 1 && pressed.size === 1 ? event.code : null;
      return;
    }

    pendingModifier = null;
    // Arming also allows deletion keys themselves to be bound while preserving the quick-clear gesture.
    save(!armed && ['Delete', 'Backspace'].includes(event.code) ? '' : inputBindingForKey(event.code, event));
  });
  // A modifier commits only if no other key/button participated before its release.
  input.addEventListener('keyup', (event) => {
    pressed.delete(event.code);
    if (event.code !== pendingModifier) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) save(event.code);
    else pendingModifier = null;
  });
  input.addEventListener('pointerdown', (event) => {
    pendingModifier = null;
    const key = inputMouseButtonCode(event.button);
    if (!key) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.metaKey) save(inputBindingForKey(key, event));
  });
  // Middle-click autoscroll and side-button navigation must not escape the capture field.
  for (const type of ['pointerup', 'mouseup', 'auxclick'])
    input.addEventListener(type, (event) => {
      if (!inputMouseButtonCode((event as MouseEvent).button)) return;
      event.preventDefault();
      event.stopPropagation();
    });
}
