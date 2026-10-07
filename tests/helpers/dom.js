/** Captures rendered markup without mounting browser nodes so view tests stay DOM-independent. */
export function inertContainer() {
  const attributes = new Map();
  return {
    innerHTML: '',
    // Retain root metadata so renderers can publish freshness and accessibility state without browser nodes.
    dataset: {},
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    // Section mounts append without replacing previously mounted sibling markup.
    insertAdjacentHTML(_position, html) {
      this.innerHTML += html;
    },
    querySelector: () => null,
    querySelectorAll: () => []
  };
}
