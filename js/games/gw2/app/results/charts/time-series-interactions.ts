import { clamp } from '#kernel/core/numeric.js';
import { escapeHtml } from '#ui/shared/html.js';
import { chartValueAt, type ChartPoint } from '#gw2/app/results/charts/time-series-model.js';

export interface InteractiveChartPanel {
  readonly kind: string;
  readonly layout: {
    readonly cssWidth: number;
    readonly height: number;
    readonly pad: { readonly left: number; readonly top: number };
    readonly plotWidth: number;
    readonly plotHeight: number;
  } | null;
  readonly lines: readonly {
    readonly name: string;
    readonly points: readonly ChartPoint[];
    readonly unit?: string;
  }[];
}

/** Share a fight-clock cursor and drag selection across panels without repainting their data on pointer movement. */
export function bindTimeSeriesInteractions(
  container: HTMLElement,
  panels: () => readonly InteractiveChartPanel[],
  range: () => { start: number; end: number; offset: number },
  zoom: (start: number, end: number) => void,
  reset: () => void
): () => void {
  let cursor: number | null = null;
  let drag: { pointerId: number; start: number; x: number; canvas: HTMLCanvasElement } | null = null;
  const hide = (): void => {
    cursor = null;
    for (const element of container.querySelectorAll<HTMLElement>('.chart-crosshair, .chart-selection')) {
      element.hidden = true;
    }

    for (const panel of panels()) {
      const tooltip = container.querySelector<HTMLElement>(`[data-role="${panel.kind}-tooltip"]`);
      if (tooltip) tooltip.style.display = 'none';
    }
  };

  const show = (time: number): void => {
    cursor = time;
    const { start, end, offset } = range();
    for (const panel of panels()) {
      const layout = panel.layout;
      const canvas = container.querySelector<HTMLCanvasElement>(`[data-role="${panel.kind}-canvas"]`);
      const wrap = canvas?.parentElement;
      const crosshair = wrap?.querySelector<HTMLElement>('.chart-crosshair');
      const selection = wrap?.querySelector<HTMLElement>('.chart-selection');
      const tooltip = wrap?.querySelector<HTMLElement>('.chart-tooltip');
      if (!layout || !canvas || !crosshair || !selection || !tooltip) continue;
      const scale = canvas.getBoundingClientRect().width / layout.cssWidth;
      const xAt = (value: number): number =>
        (layout.pad.left + ((value - start) / (end - start)) * layout.plotWidth) * scale;
      const x = xAt(time);
      crosshair.hidden = false;
      crosshair.style.left = `${x}px`;
      crosshair.style.top = `${layout.pad.top}px`;
      crosshair.style.height = `${layout.plotHeight}px`;
      crosshair.dataset.time = String(offset + time);
      selection.hidden = !drag;
      if (drag) {
        selection.style.left = `${xAt(Math.min(drag.start, time))}px`;
        selection.style.width = `${Math.abs(x - xAt(drag.start))}px`;
        selection.style.top = `${layout.pad.top}px`;
        selection.style.height = `${layout.plotHeight}px`;
      }

      const entries = panel.lines.map((line) => {
        const value = chartValueAt(line.points, time);
        const display = panel.kind === 'dps' ? Math.round(value).toLocaleString() : String(Number(value.toFixed(2)));
        return `<div>${escapeHtml(line.name)}: ${escapeHtml(display + (line.unit || ''))}</div>`;
      });
      tooltip.innerHTML = `<div><b>${((offset + time) / 1000).toFixed(3)}s</b></div>${entries.join('') || '<div>No visible effects</div>'}`;
      tooltip.style.left = '0px';
      tooltip.style.top = `${layout.pad.top + 8}px`;
      tooltip.style.display = drag ? 'none' : 'block';
      tooltip.style.left = `${clamp(x + 12, 0, Math.max(0, canvas.clientWidth - tooltip.offsetWidth - 4))}px`;
    }
  };

  const cancel = (): void => {
    const previous = drag;
    drag = null;
    if (previous?.canvas.hasPointerCapture(previous.pointerId))
      previous.canvas.releasePointerCapture(previous.pointerId);
    hide();
  };

  for (const panel of panels()) {
    const canvas = container.querySelector<HTMLCanvasElement>(`[data-role="${panel.kind}-canvas"]`);
    if (!canvas) continue;
    const pointerTime = (event: PointerEvent, outside = false): number | null => {
      const layout = panels().find((entry) => entry.kind === panel.kind)?.layout;
      if (!layout || layout.plotWidth <= 0) return null;
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * layout.cssWidth;
      const y = ((event.clientY - rect.top) / rect.height) * layout.height;
      if (
        !outside &&
        (x < layout.pad.left ||
          x > layout.pad.left + layout.plotWidth ||
          y < layout.pad.top ||
          y > layout.pad.top + layout.plotHeight)
      )
        return null;
      const { start, end } = range();
      return start + clamp((x - layout.pad.left) / layout.plotWidth, 0, 1) * (end - start);
    };

    canvas.onpointermove = (event) => {
      if (drag && drag.pointerId !== event.pointerId) return;
      const time = pointerTime(event, Boolean(drag));
      if (time === null) hide();
      else show(time);
    };

    canvas.onpointerleave = () => {
      if (!drag) hide();
    };

    canvas.onpointerdown = (event) => {
      if (event.button !== 0 || !event.isPrimary || drag) return;
      const time = pointerTime(event);
      if (time === null) return;
      // Blur the previously focused panel before establishing this drag's shared state.
      canvas.focus({ preventScroll: true });
      drag = { pointerId: event.pointerId, start: time, x: event.clientX, canvas };
      canvas.setPointerCapture(event.pointerId);
      show(time);
    };

    canvas.onpointerup = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const previous = drag;
      const time = pointerTime(event, true);
      cancel();
      if (time !== null && Math.abs(event.clientX - previous.x) >= 6 && Math.abs(time - previous.start) >= 1) {
        zoom(Math.min(time, previous.start), Math.max(time, previous.start));
      }
    };

    canvas.onpointercancel = cancel;
    canvas.onlostpointercapture = cancel;
    canvas.onblur = cancel;
    // Keyboard users can inspect samples, zoom around the cursor, and restore the current phase.
    canvas.onkeydown = (event) => {
      if (event.key === 'Escape') {
        cancel();
        reset();
        return;
      }

      const { start, end } = range();
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        show(
          clamp(
            (cursor ?? (start + end) / 2) + ((event.key === 'ArrowLeft' ? -1 : 1) * (end - start)) / 100,
            start,
            end
          )
        );
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        const center = cursor ?? (start + end) / 2;
        const width = (end - start) / 2;
        const left = clamp(center - width / 2, start, end - width);
        if (width >= 1) zoom(left, left + width);
      }
    };
  }

  return cancel;
}
