/** Keep responsive table styling tied to measured overflow and panel placement, without numeric breakpoints. */
const observers = new WeakMap<HTMLElement, ResizeObserver>();

export function bindDamageBreakdownLayout(container: HTMLElement): void {
  observers.get(container)?.disconnect();
  observers.delete(container);
  const damage = container.querySelector<HTMLElement>('.res-damage-breakdown');
  const scroll = damage?.querySelector<HTMLElement>('.res-skill-scroll');
  const pair = damage?.parentElement;
  const view = damage?.ownerDocument.defaultView;

  if (!damage || !scroll || !pair || !view) return;

  let wasConnected = damage.isConnected;
  const update = () => {
    if (!damage.isConnected) {
      if (wasConnected) observer.disconnect();

      return;
    }

    wasConnected = true;
    const compact = String(scroll.scrollWidth > scroll.clientWidth);

    if (damage.dataset.compact !== compact) damage.dataset.compact = compact;

    const conditions = pair.querySelector<HTMLElement>('.res-condition-breakdown');
    const sideBySide = String(
      Boolean(conditions && Math.abs(conditions.getBoundingClientRect().top - damage.getBoundingClientRect().top) < 1)
    );

    if (pair.dataset.sideBySide !== sideBySide) pair.dataset.sideBySide = sideBySide;
  };

  const observer = new view.ResizeObserver(update);
  observers.set(container, observer);
  observer.observe(pair);
  observer.observe(scroll);
  update();
}
