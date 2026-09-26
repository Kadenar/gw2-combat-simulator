import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

const observers = new WeakMap<ElementalistRuntime, (runtime: ElementalistRuntime, event: Gw2ResolverEvent) => void>();

/** The active elite observes actual Core transition facts without registering a second event owner. */
export function registerElementalistEliteEvents(
  runtime: ElementalistRuntime,
  observer: (runtime: ElementalistRuntime, event: Gw2ResolverEvent) => void
): void {
  observers.set(runtime, observer);
}

/** Core records its custom transition once, then lets the active elite apply its entry traits. */
export function observeElementalistTransition(runtime: ElementalistRuntime, event: Gw2ResolverEvent): void {
  runtime.history.push(event);
  observers.get(runtime)?.(runtime, event);
}
