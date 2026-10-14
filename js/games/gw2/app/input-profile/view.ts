import { bindInputCapture } from '#gw2/app/shared/input-binding-capture.js';
import { bindDialog, showDialog } from '#browser/page/dialog.js';
import { ensureInputProfileStyles } from '#gw2/app/input-profile/styles.js';
import { escapeHtml as html } from '#ui/shared/html.js';
import { INPUT_CONTROLS, defaultInputBindings, formatInputBinding } from '#gw2/input/bindings.js';
import { type InputControlId } from '#gw2/platform/skills/input-controls.js';
import { createInputProfile, validateInputProfile, type InputProfile } from '#gw2/input/profile.js';
import { activeInputProfile, saveInputProfile } from '#gw2/app/input-profile/store.js';
import { loadRotationHotkeyBindings } from '#gw2/app/rotation/hotkeys.js';

/** Edit snapshots in a draft; saving rescans observers without altering editor bindings or combat state. */
export function showInputProfileDialog(document: Document): void {
  ensureInputProfileStyles(document);
  let draft: InputProfile;
  let initialError = '';
  try {
    draft = activeInputProfile();
  } catch (error) {
    initialError = String(error);
    draft = createInputProfile();
  }

  let choices: Partial<Record<InputControlId, readonly string[]>> = {};
  const dialog = document.createElement('dialog');
  dialog.className = 'app-dialog input-profile-dialog';
  dialog.setAttribute('aria-label', 'Keybind profile');
  const errorText = (message: string): void => {
    dialog.querySelector<HTMLElement>('[data-profile-status]')!.textContent = message;
  };

  const sync = (): void => {
    const bindings = { ...draft.bindings };
    for (const input of dialog.querySelectorAll<HTMLInputElement>('[data-binding]'))
      bindings[input.dataset.binding as InputControlId] = input.dataset.code ?? '';
    draft = createInputProfile(bindings);
  };

  const replaceBindings = (bindings: InputProfile['bindings']): void => {
    draft = createInputProfile(bindings);
    choices = {};
    render();
  };

  const render = (): void => {
    dialog.innerHTML = `<form method="dialog" class="app-dialog-body"><h2>Keybind profile</h2>
      <div class="app-dialog-actions"><button type="button" class="btn" data-defaults>Use defaults</button><button type="button" class="btn" data-copy-editor>Copy current editor</button><button type="button" class="btn" data-import>Import</button></div>
      <input type="file" accept=".xml" data-import-file hidden>
      <p>Focus a binding and press a key, release a lone modifier, or click Mouse 3/4/5. Delete or Backspace clears it. Tab moves focus; press Enter first to bind Tab, Delete, Backspace, or Enter. Escape cancels armed capture; otherwise it closes the dialog.</p>
      <div class="input-profile-fields"><table><thead><tr><th>Control</th><th>Binding</th></tr></thead><tbody>${INPUT_CONTROLS.map(({ id, label }) => `<tr><th scope="row">${html(label)}</th><td><input readonly aria-label="${html(label)} binding" data-binding="${id}" data-code="${html(draft.bindings[id])}" value="${html(formatInputBinding(draft.bindings[id]))}">${(choices[id]?.length ?? 0) > 1 ? `<select data-binding-choice="${id}" aria-label="${html(label)} imported binding"><option value="">Choose your usual binding</option>${choices[id]!.map((code) => `<option value="${html(code)}" ${draft.bindings[id] === code ? 'selected' : ''}>${html(formatInputBinding(code))}</option>`).join('')}</select>` : ''}</td></tr>`).join('')}</tbody></table></div>
      <p role="status" data-profile-status>${html(initialError)}</p><div class="app-dialog-actions"><button type="button" class="btn" data-dialog-close>Cancel</button><button type="button" class="btn btn-run" data-save>Save</button></div></form>`;
    dialog
      .querySelector('[data-copy-editor]')!
      .addEventListener('click', () => replaceBindings(loadRotationHotkeyBindings()));
    dialog.querySelector('[data-defaults]')!.addEventListener('click', () => replaceBindings(defaultInputBindings()));
    for (const input of dialog.querySelectorAll<HTMLInputElement>('[data-binding]')) {
      const set = (code: string): void => {
        input.dataset.code = code;
        input.value = formatInputBinding(code);
        sync();
        const choice = input.parentElement?.querySelector<HTMLSelectElement>('[data-binding-choice]');
        if (choice) choice.value = code;
      };

      bindInputCapture(input, set);
    }

    for (const select of dialog.querySelectorAll<HTMLSelectElement>('[data-binding-choice]'))
      select.addEventListener('change', () => {
        sync();
        draft.bindings[select.dataset.bindingChoice as InputControlId] = select.value;
        render();
      });
    const file = dialog.querySelector<HTMLInputElement>('[data-import-file]')!;
    dialog.querySelector('[data-import]')!.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const selected = file.files?.[0];
      if (!selected) return;
      try {
        const contents = await selected.text();
        const { parseGw2HotkeyBindingsXml } = await import('#gw2/integrations/keybinds/parser.js');
        const result = parseGw2HotkeyBindingsXml(contents);
        choices = result.bindingOptions;
        // Missing controls stay unbound, and multiple alternatives require an explicit selection.
        draft = {
          ...draft,
          bindings: Object.fromEntries(
            INPUT_CONTROLS.map(({ id }) => [id, choices[id]?.length === 1 ? choices[id]![0] : ''])
          ) as InputProfile['bindings']
        };

        render();
        errorText('Imported. Review your bindings and choose any alternatives before saving.');
      } catch (error) {
        errorText(String(error));
      }
    });
    dialog.querySelector('[data-save]')!.addEventListener('click', () => {
      try {
        sync();
        draft = validateInputProfile(draft);
        saveInputProfile(draft);
        dialog.close();
      } catch (error) {
        errorText(String(error));
      }
    });
  };

  render();
  // Side-button releases must not navigate the browser while capturing a mouse binding.
  for (const type of ['pointerup', 'mouseup', 'auxclick'])
    dialog.addEventListener(type, (event) => {
      if ([1, 3, 4].includes((event as MouseEvent).button)) {
        event.preventDefault();
        event.stopPropagation();
      }
    });
  bindDialog(dialog);
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  showDialog(dialog);
}
