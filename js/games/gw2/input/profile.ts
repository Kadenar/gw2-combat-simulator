import { INPUT_CONTROLS, defaultInputBindings, parseInputBinding, type InputBindings } from '#gw2/input/bindings.js';

export const INPUT_PROFILE_VERSION = 1;
export interface InputProfile {
  readonly version: 1;
  readonly bindings: InputBindings;
}

/** Distinguish invalid saved bindings from storage access failures and unrelated analysis errors. */
export class InputProfileError extends TypeError {
  constructor(reason: string) {
    super(`Invalid keybind setup: ${reason} Use defaults, copy editor bindings, or import GW2 XML to reset it.`);
    this.name = 'InputProfileError';
  }
}

/** Missing controls mean unbound; only a new default setup receives default bindings. */
export function createInputProfile(bindings: Partial<InputBindings> = defaultInputBindings()): InputProfile {
  return {
    version: INPUT_PROFILE_VERSION,
    bindings: Object.fromEntries(INPUT_CONTROLS.map(({ id }) => [id, bindings[id] ?? ''])) as InputBindings
  };
}

/** Validate sparse saved bindings and identify the control that needs correction. */
export function validateInputProfile(value: unknown): InputProfile {
  const fail = (reason: string): never => {
    throw new InputProfileError(reason);
  };

  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('expected a setup object.');
  const p = value as InputProfile;
  if (p.version !== INPUT_PROFILE_VERSION) return fail('unsupported version.');
  if (!p.bindings || typeof p.bindings !== 'object' || Array.isArray(p.bindings)) return fail('expected bindings.');
  for (const [id, binding] of Object.entries(p.bindings)) {
    const control = INPUT_CONTROLS.find((control) => control.id === id);
    if (!control) return fail(`unknown control "${id}".`);
    if (typeof binding !== 'string' || (binding !== '' && !parseInputBinding(binding)))
      return fail(`${control.label} (${id}) has an unsupported binding ${JSON.stringify(binding)}.`);
  }

  return createInputProfile(p.bindings);
}
