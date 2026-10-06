/** Link health-chart marks by build identity, keeping transient emphasis separate from persistent comparison pins. */
export function mountHealthInteractions(host: HTMLElement): { refresh: () => void; reset: () => void } {
  const pins = new Set<string>();
  let hovered: string | undefined;
  let focused: string | undefined;
  let pinnedOnly = false;
  let observedLayout: HTMLElement | null = null;

  const seriesAt = (target: EventTarget | null): string | undefined =>
    target instanceof Element ? target.closest<HTMLElement>('[data-health-series]')?.dataset.healthSeries : undefined;

  function highlight(): void {
    host.classList.toggle('health-pinned-only', pinnedOnly);
    const active = new Set([...pins, hovered, focused].filter((key): key is string => key !== undefined));
    for (const mark of host.querySelectorAll<HTMLElement | SVGElement>('[data-health-series]')) {
      const key = mark.dataset.healthSeries!;
      mark.classList.toggle('is-health-active', active.has(key));
      mark.classList.toggle('is-health-muted', active.size > 0 && !active.has(key));
      mark.classList.toggle('is-health-pinned', pins.has(key));
      if (mark.hasAttribute('data-health-point')) mark.setAttribute('aria-pressed', String(pins.has(key)));
      mark.querySelector('[data-health-toggle]')?.setAttribute('aria-pressed', String(pins.has(key)));
    }

    const count = host.querySelector('[data-health-visible-count]');
    if (count) count.textContent = String(pinnedOnly ? pins.size : host.querySelectorAll('[data-health-row]').length);
    const empty = host.querySelector<HTMLElement>('[data-health-pinned-empty]');
    if (empty) empty.hidden = !pinnedOnly || pins.size > 0;
  }

  /** Spread labels vertically without moving data points, connecting each label back to its actual endpoint. */
  function positionLabels(): void {
    const layout = host.querySelector<HTMLElement>('.health-chart-layout');
    const plot = host.querySelector<HTMLElement>('.health-plot');
    const lane = host.querySelector<HTMLElement>('.health-pin-labels');
    if (!layout || !plot || !lane || lane.hidden || !plot.clientHeight) return;
    const plotRect = plot.getBoundingClientRect();
    const laneRect = lane.getBoundingClientRect();
    const points = [...host.querySelectorAll<HTMLElement>('[data-health-point]')];
    const labels = [...lane.querySelectorAll<HTMLElement>('.health-pin-label')]
      .map((label) => {
        const endpoint = points.filter((point) => point.dataset.healthSeries === label.dataset.healthSeries).at(-1)!;
        const rect = endpoint.getBoundingClientRect();
        return {
          label,
          height: label.offsetHeight,
          x: rect.x + rect.width / 2 - laneRect.x,
          y: rect.y + rect.height / 2 - plotRect.y,
          top: 0
        };
      })
      .sort((a, b) => a.y - b.y);
    const gap = 10;
    const needed = labels.reduce((height, label) => height + label.height + gap, -gap);
    layout.style.setProperty('--health-label-min-height', `${Math.max(360, needed)}px`);
    let bottom = 0;
    for (const label of labels) {
      label.top = Math.max(bottom, label.y - label.height / 2);
      bottom = label.top + label.height + gap;
    }

    let limit = plot.clientHeight;
    for (const label of [...labels].reverse()) {
      label.top = Math.min(label.top, limit - label.height);
      limit = label.top - gap;
    }

    const connectors = lane.querySelector<SVGElement>('.health-pin-connectors')!;
    connectors.replaceChildren();
    for (const { label, x, y, top, height } of labels) {
      label.style.top = `${Math.max(0, top)}px`;
      const line = host.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x));
      line.setAttribute('y1', String(y));
      line.setAttribute('x2', '0');
      line.setAttribute('y2', String(Math.max(0, top) + height / 2));
      line.style.stroke = label.style.getPropertyValue('--benchmark-color');
      connectors.append(line);
    }
  }

  const observer = new ResizeObserver(positionLabels);

  /** Reconcile pins with visible builds after filters or metrics change, preserving identity across new markup. */
  function refresh(): void {
    const points = [...host.querySelectorAll<HTMLElement>('[data-health-point]')];
    const visible = new Set(points.map((point) => point.dataset.healthSeries!));
    for (const key of pins) if (!visible.has(key)) pins.delete(key);
    hovered = undefined;
    focused = undefined;
    const toggle = host.querySelector<HTMLInputElement>('[data-health-pinned-only]');
    if (toggle) toggle.checked = pinnedOnly;
    const status = host.querySelector<HTMLElement>('[data-health-pin-status]');
    if (status) status.textContent = pins.size ? `${pins.size} ${pins.size === 1 ? 'build' : 'builds'} pinned.` : '';
    const layout = host.querySelector<HTMLElement>('.health-chart-layout');
    const lane = host.querySelector<HTMLElement>('.health-pin-labels');
    if (observedLayout !== layout) {
      observer.disconnect();
      observedLayout = layout;
      if (layout) observer.observe(layout);
    }

    if (lane && layout) {
      lane.replaceChildren();
      lane.hidden = pins.size === 0;
      layout.classList.toggle('has-health-pins', pins.size > 0);
      layout.style.removeProperty('--health-label-min-height');
      const connectors = host.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
      connectors.classList.add('health-pin-connectors');
      connectors.setAttribute('aria-hidden', 'true');
      lane.append(connectors);
      for (const key of pins) {
        const endpoint = points.filter((point) => point.dataset.healthSeries === key).at(-1)!;
        const label = host.ownerDocument.createElement('div');
        label.className = 'health-pin-label';
        label.dataset.healthSeries = key;
        label.style.setProperty('--benchmark-color', endpoint.style.getPropertyValue('--benchmark-color'));
        const name = host.ownerDocument.createElement('span');
        name.textContent = endpoint.dataset.healthName!;
        const remove = host.ownerDocument.createElement('button');
        remove.type = 'button';
        remove.dataset.unpinHealth = key;
        remove.textContent = '\u00d7';
        remove.title = `Unpin ${name.textContent}`;
        remove.setAttribute('aria-label', remove.title);
        label.append(name, remove);
        lane.append(label);
      }

      positionLabels();
    }

    highlight();
  }

  host.addEventListener('pointermove', (event) => {
    hovered = seriesAt(event.target);
    highlight();
  });
  // Keep the comparison population linked when narrowing to pinned builds, including after a table sort.
  host.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches('[data-health-pinned-only]')) return;
    pinnedOnly = target.checked;
    hovered = focused = undefined;
    highlight();
  });
  host.addEventListener('pointerleave', () => {
    hovered = undefined;
    highlight();
  });
  host.addEventListener('focusin', (event) => {
    focused = seriesAt(event.target);
    highlight();
  });
  host.addEventListener('focusout', (event) => {
    focused = host.contains(event.relatedTarget as Node | null) ? seriesAt(event.relatedTarget) : undefined;
    highlight();
  });
  host.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    hovered = focused = undefined;
    highlight();
  });
  host.addEventListener('click', (event) => {
    const target = event.target as Element;
    const remove = target.closest<HTMLButtonElement>('[data-unpin-health]');
    // Table rows and chart marks toggle the same pin, while rows without measurements cannot be pinned.
    const point = target.closest<HTMLElement>('[data-health-point], .health-line, [data-health-row]');
    const key = remove?.dataset.unpinHealth ?? point?.dataset.healthSeries;
    if (!key) return;
    if (
      ![...host.querySelectorAll<HTMLElement>('[data-health-point]')].some((mark) => mark.dataset.healthSeries === key)
    )
      return;
    const status = host.querySelector<HTMLElement>('[data-health-pin-status]')!;
    if (pins.has(key)) pins.delete(key);
    else if (pins.size < 5) pins.add(key);
    else {
      status.textContent = 'Up to 5 builds can be pinned. Unpin a build to add another.';
      return;
    }

    refresh();
    // Removing a pin must not refocus its point, which would immediately restore transient highlighting.
    if (!remove) {
      hovered = key;
      highlight();
    }
  });
  return {
    refresh,
    // Global reset clears the local comparison filter too, so an empty pin set cannot hide every build.
    reset: () => {
      pins.clear();
      pinnedOnly = false;
      refresh();
    }
  };
}
