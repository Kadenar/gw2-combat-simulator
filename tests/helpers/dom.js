/** Captures rendered markup without mounting browser nodes so view tests stay DOM-independent. */
export function inertContainer() {
  return {
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => []
  };
}
