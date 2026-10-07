import {
  comparisonDpsAt,
  type ComparisonMode,
  type ComparisonResult
} from '#gw2/app/page/benchmark-comparison/model.js';
import { chartAxisMaximum, type ChartPoint } from '#gw2/app/results/charts/time-series-model.js';

export interface ComparisonLine {
  readonly color: string;
  readonly dash: readonly number[];
  readonly points: readonly ChartPoint[];
  readonly result: ComparisonResult;
}

interface ChartState {
  readonly lines: readonly ComparisonLine[];
  readonly mode: ComparisonMode;
  readonly cursor: number;
  readonly pinned: boolean;
  readonly durationMs: number;
}

/** Keep drawing and native pointer/keyboard inspection independent from selection and simulation lifecycles. */
export function mountComparisonChart(
  canvas: HTMLCanvasElement,
  state: () => ChartState,
  inspect: (timeMs: number, pin?: boolean) => void,
  rangeChanged: (start: number, end: number, zoomed: boolean) => void
): { draw: () => void; reset: () => void; dispose: () => void } {
  const context = canvas.getContext('2d')!;
  const events = new AbortController();
  let range: [number, number] | null = null;
  let drag: { id: number; start: number; end: number; x: number; moved: boolean } | null = null;
  const padding = { left: 49, right: 20, top: 24, bottom: 32 };
  const visibleRange = (): [number, number] => range ?? [0, Math.max(1000, state().durationMs)];
  const timeAt = (event: PointerEvent): number => {
    const rect = canvas.getBoundingClientRect();
    const [start, end] = visibleRange();
    const fraction = (event.clientX - rect.left - padding.left) / (rect.width - padding.left - padding.right);
    return Math.round(start + Math.min(1, Math.max(0, fraction)) * (end - start));
  };

  function draw(): void {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const current = state();
    const ratio = canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const [start, end] = visibleRange();
    // Include zoom boundaries even when a narrow selection falls between the display's 250ms samples.
    const values = current.lines.flatMap((line) => [
      ...line.points.filter((point) => point.t >= start && point.t <= end).map((point) => point.v),
      comparisonDpsAt(line.result, start, current.mode) ?? 0,
      comparisonDpsAt(line.result, Math.min(end, line.result.durationMs), current.mode) ?? 0
    ]);
    const maximum = chartAxisMaximum(values, true);
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const xAt = (time: number): number => padding.left + ((time - start) / (end - start)) * plotWidth;
    const yAt = (value: number): number => height - padding.bottom - (value / maximum) * plotHeight;
    context.font = '10px Consolas, monospace';
    context.textBaseline = 'middle';
    context.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const value = (maximum * i) / 4;
      const y = yAt(value);
      context.fillStyle = '#96928a';
      context.textAlign = 'right';
      context.fillText(value ? `${Number((value / 1000).toFixed(1))}k` : '0', padding.left - 9, y);
      context.strokeStyle = '#302c31';
      context.setLineDash([2, 4]);
      context.beginPath();
      context.moveTo(padding.left, y);
      context.lineTo(width - padding.right, y);
      context.stroke();
    }

    context.textAlign = 'left';
    context.fillText('DPS', 0, 9);
    const ticks = width < 500 ? 4 : 6;
    for (let i = 0; i <= ticks; i++) {
      const time = start + ((end - start) * i) / ticks;
      context.textAlign = i === 0 ? 'left' : i === ticks ? 'right' : 'center';
      context.fillText(`${Number((time / 1000).toFixed(1))}s`, xAt(time), height - 11);
    }

    context.save();
    context.beginPath();
    context.rect(padding.left, padding.top, plotWidth, plotHeight);
    context.clip();
    for (const line of current.lines) {
      // Match legend patterns so overlapping same-profession builds remain distinguishable without color alone.
      context.setLineDash([...line.dash]);
      context.strokeStyle = line.color;
      context.lineWidth = 2.25;
      context.beginPath();
      line.points.forEach((point, index) => {
        if (index === 0) context.moveTo(xAt(point.t), yAt(point.v));
        else context.lineTo(xAt(point.t), yAt(point.v));
      });
      context.stroke();
      const last = line.points.at(-1);
      if (last) {
        context.fillStyle = line.color;
        context.beginPath();
        context.arc(xAt(last.t), yAt(last.v), 3, 0, Math.PI * 2);
        context.fill();
      }
    }

    if (drag?.moved) {
      context.fillStyle = '#d3b69022';
      context.fillRect(
        xAt(Math.min(drag.start, drag.end)),
        padding.top,
        Math.abs(xAt(drag.end) - xAt(drag.start)),
        plotHeight
      );
    }

    if (current.lines.length && current.cursor >= start && current.cursor <= end) {
      const x = xAt(current.cursor);
      context.strokeStyle = '#d3b690aa';
      context.lineWidth = 1;
      context.setLineDash([4, 4]);
      context.beginPath();
      context.moveTo(x, padding.top);
      context.lineTo(x, height - padding.bottom);
      context.stroke();
      context.setLineDash([]);
      for (const line of current.lines) {
        const value = comparisonDpsAt(line.result, current.cursor, current.mode);
        if (value === null) continue;
        context.fillStyle = line.color;
        context.strokeStyle = '#171717';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(x, yAt(value), 4, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
    }

    context.restore();
    if (current.lines.length && current.cursor >= start && current.cursor <= end) {
      const x = Math.max(padding.left, Math.min(width - 90, xAt(current.cursor) - 35));
      context.fillStyle = '#d3b690';
      context.fillRect(x, 0, 76, 18);
      context.fillStyle = '#201b17';
      context.textAlign = 'center';
      context.fillText(`${(current.cursor / 1000).toFixed(3)}s`, x + 38, 9);
    }

    rangeChanged(start, end, range !== null);
  }

  function reset(): void {
    range = null;
    draw();
  }

  function release(): void {
    const pointer = drag;
    drag = null;
    if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id);
    draw();
  }

  const options = { signal: events.signal };
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      canvas.focus({ preventScroll: true });
      drag = { id: event.pointerId, start: timeAt(event), end: timeAt(event), x: event.clientX, moved: false };
      canvas.setPointerCapture(event.pointerId);
    },
    options
  );
  canvas.addEventListener(
    'pointermove',
    (event) => {
      if (drag) {
        if (event.pointerId !== drag.id) return;
        drag.end = timeAt(event);
        drag.moved ||= Math.abs(event.clientX - drag.x) > 6;
        draw();
      } else if (!state().pinned) inspect(timeAt(event));
    },
    options
  );
  canvas.addEventListener(
    'pointerup',
    (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      if (drag.moved && Math.abs(drag.end - drag.start) >= 1)
        range = [Math.min(drag.start, drag.end), Math.max(drag.start, drag.end)];
      else inspect(timeAt(event), true);
      release();
    },
    options
  );
  canvas.addEventListener('pointercancel', release, options);
  canvas.addEventListener('lostpointercapture', release, options);
  canvas.addEventListener('blur', release, options);
  canvas.addEventListener('dblclick', reset, options);
  canvas.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        // Dismiss mouse-pinned inspection completely; retain normal focus rings for keyboard navigation.
        event.preventDefault();
        release();
        inspect(state().cursor, false);
        reset();
        canvas.blur();
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const [start, end] = visibleRange();
        inspect(Math.min(end, Math.max(start, state().cursor + (event.key === 'ArrowLeft' ? -250 : 250))), true);
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        inspect(state().cursor, !state().pinned);
      }
    },
    options
  );
  const observer = new ResizeObserver(draw);
  observer.observe(canvas);
  return {
    draw,
    reset,
    dispose: () => {
      events.abort();
      observer.disconnect();
    }
  };
}
