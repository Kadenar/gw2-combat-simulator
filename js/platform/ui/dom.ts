// Shared DOM lookup guards for build/config panels.

/**
 * Returns the element with the given id or throws when it is missing.
 *
 * @param {string} id Element id to look up.
 * @returns {HTMLElement} The matching element.
 * @throws {Error} When no element with the id exists.
 */
export function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required element #${id} is missing.`);
  return element;
}

/**
 * Returns the `<input>` with the given id or throws when it is missing or of the
 * wrong type.
 *
 * @param {string} id Element id to look up.
 * @returns {HTMLInputElement} The matching input.
 * @throws {Error} When the element is missing.
 * @throws {TypeError} When the element is not an `<input>`.
 */
export function requiredInput(id: string): HTMLInputElement {
  const element = requiredElement(id);
  if (!(element instanceof HTMLInputElement)) {
    throw new TypeError(`Element #${id} must be an <input>.`);
  }
  return element;
}

/**
 * Returns the `<select>` with the given id or throws when it is missing or of
 * the wrong type.
 *
 * @param {string} id Element id to look up.
 * @returns {HTMLSelectElement} The matching select.
 * @throws {Error} When the element is missing.
 * @throws {TypeError} When the element is not a `<select>`.
 */
export function requiredSelect(id: string): HTMLSelectElement {
  const element = requiredElement(id);
  if (!(element instanceof HTMLSelectElement)) {
    throw new TypeError(`Element #${id} must be a <select>.`);
  }
  return element;
}

/**
 * Returns the value-bearing control with the given id or throws when it is
 * missing or cannot expose a value.
 *
 * @param {string} id Element id to look up.
 * @returns {HTMLInputElement | HTMLSelectElement} The matching control.
 * @throws {Error} When the element is missing.
 * @throws {TypeError} When the element is neither an `<input>` nor a `<select>`.
 */
export function requiredValueControl(
  id: string,
): HTMLInputElement | HTMLSelectElement {
  const element = requiredElement(id);
  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLSelectElement)
  ) {
    throw new TypeError(`Element #${id} must expose a value.`);
  }
  return element;
}

/**
 * Extracts a human-readable message from a thrown value.
 *
 * @param {unknown} error Thrown value.
 * @returns {string} The error message, or the stringified value.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
