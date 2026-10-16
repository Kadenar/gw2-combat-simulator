import { createInputProfile, validateInputProfile, InputProfileError, type InputProfile } from '#gw2/input/profile.js';

export const INPUT_PROFILE_STORAGE_KEY = 'gw2-input-profile';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
let session: InputProfile | undefined;
const listeners = new Map<() => void, HTMLElement | undefined>();

function browserStorage(): StoragePort | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Unavailable storage starts with defaults; malformed stored profiles still require an explicit reset. */
export function readInputProfile(storage: StoragePort | null = browserStorage()): InputProfile {
  let raw: string | null;
  try {
    raw = typeof storage?.getItem === 'function' ? storage.getItem(INPUT_PROFILE_STORAGE_KEY) : null;
  } catch {
    return createInputProfile();
  }

  if (!raw) return createInputProfile();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InputProfileError('saved data is not valid JSON.');
  }

  return validateInputProfile(parsed);
}

export function activeInputProfile(): InputProfile {
  return structuredClone((session ??= readInputProfile()));
}

/**
 * Valid saves always update the current session, even when browser storage is blocked or full.
 * Only persistence errors are ignored; validation and observer errors remain visible.
 */
export function saveInputProfile(profile: InputProfile, storage: StoragePort | null = browserStorage()): void {
  const next = validateInputProfile(profile);
  try {
    storage?.setItem(
      INPUT_PROFILE_STORAGE_KEY,
      JSON.stringify({
        ...next,
        bindings: Object.fromEntries(Object.entries(next.bindings).filter(([, binding]) => binding !== ''))
      })
    );
  } catch {
    // Blocked storage, quota errors, and incomplete host storage APIs must not prevent session-only bindings.
  }

  session = next;
  for (const [listener, owner] of listeners) {
    if (owner && !owner.isConnected) listeners.delete(listener);
    else listener();
  }
}

/** Retired result panels release their trace closures when the next panel subscribes. */
export function subscribeInputProfile(listener: () => void, owner?: HTMLElement): () => void {
  for (const [callback, element] of listeners) if (element && !element.isConnected) listeners.delete(callback);
  listeners.set(listener, owner);
  return () => listeners.delete(listener);
}
