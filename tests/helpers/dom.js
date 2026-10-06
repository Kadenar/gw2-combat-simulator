/** Captures rendered markup without mounting browser nodes so view tests stay DOM-independent. */
export function inertContainer() {
  return {
    innerHTML: '',
    // Section mounts append without replacing previously mounted sibling markup.
    insertAdjacentHTML(_position, html) {
      this.innerHTML += html;
    },
    querySelector: () => null,
    querySelectorAll: () => []
  };
}
