import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

const roots = new WeakMap<HTMLElement, Root>();

/** Reuses one React root per stable container so repeated application renders update rather than remount panels. */
export function renderReact(container: HTMLElement, node: ReactNode): void {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }

  root.render(node);
}
