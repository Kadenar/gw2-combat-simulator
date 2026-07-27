import { escapeHtml } from "./html.js";

export function chartValueAt(points, time) {
  if (!points?.length) return 0;
  let value = Number(points[0].v || 0);
  for (const point of points) {
    if (Number(point.t || 0) > time) break;
    value = Number(point.v || 0);
  }
  return value;
}

export function buildChartSeries(
  result,
  sampleStepMs = 250,
  { effectName = value => String(value || ""), stackCaps = {} } = {},
) {
  const dpsStartMs = Math.max(
    0,
    Number(result.dpsStartTime ?? result.firstHitTime ?? 0) * 1000,
  );
  const endMs = Math.max(
    dpsStartMs,
    Math.round(Number(result.deathTime ?? result.duration ?? 0) * 1000),
  );
  const durationMs = Math.max(
    1,
    endMs - dpsStartMs,
  );
  const interval = Math.max(50, Math.min(1000, Number(sampleStepMs) || 250));
  const times = [];
  for (let time = 0; time < durationMs; time += interval) times.push(time);
  times.push(durationMs);
  const resolved = result.resolvedEvents || [];
  const damageEvents = resolved.filter(event =>
    (event.type === "damage" || event.type === "condition")
    && (
      Number(event.damage || 0) > 0
      || event.damageTicks?.some(tick => Number(tick.damage || 0) > 0)
    ));
  const dps = times.map(time => {
    const elapsed = time / 1000;
    if (elapsed <= 0) return { t: time, v: 0 };
    const absoluteTime = dpsStartMs + time;
    let damage = 0;
    for (const event of damageEvents) {
      if (Array.isArray(event.damageTicks)) {
        damage += event.damageTicks
          .filter(tick => Number(tick.at || 0) * 1000 <= absoluteTime)
          .reduce((sum, tick) => sum + Number(tick.damage || 0), 0);
      } else if (Number(event.at || 0) * 1000 <= absoluteTime) {
        damage += Number(event.damage || 0);
      }
    }
    return { t: time, v: damage / elapsed };
  });
  const applications = [];
  for (const event of resolved) {
    if (event.type !== "condition") continue;
    const start = Number(event.at || 0) * 1000 - dpsStartMs;
    const end = Number(
      event.expiresAt
      ?? (Number(event.at || 0) + Number(event.effectiveDuration ?? event.duration ?? 0)),
    ) * 1000 - dpsStartMs;
    if (end > start) {
      applications.push({
        name: effectName(event.condition),
        start,
        end,
        stacks: Number(event.stacks || 1),
      });
    }
  }
  for (const event of result.events || []) {
    if (event.type !== "buff" || !Number(event.duration || 0)) continue;
    const start = Number(event.at || 0) * 1000 - dpsStartMs;
    applications.push({
      name: effectName(event.kind),
      start,
      end: start + Number(event.duration) * 1000,
      stacks: Number(event.stacks || 1),
    });
  }
  const effects = {};
  for (const name of new Set(applications.map(entry => entry.name))) {
    const matching = applications.filter(entry => entry.name === name);
    effects[name] = times.map(time => ({
      t: time,
      v: Math.min(
        stackCaps[name] ?? Infinity,
        matching.reduce(
          (sum, entry) =>
            sum + (entry.start <= time && entry.end > time ? entry.stacks : 0),
          0,
        ),
      ),
    }));
  }
  return { durationMs, dps, effects };
}

const DEFAULT_OPTIONS = {
  title: "DPS & Effects Over Time",
  dpsLabel: "DPS",
  dpsColor: "#54c96b",
  colors: {},
  defaultVisibleEffectLimit: 8,
  emptyEffectsText: "No timed effects in this rotation",
};
const ACTIVE_MOUNT = Symbol("activeTimeSeriesChartMount");

const chartNumber = value => {
  const number = Number(value || 0);
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}m`;
  if (number >= 1000) {
    return `${(number / 1000).toFixed(number >= 10_000 ? 0 : 1)}k`;
  }
  return number.toFixed(number < 10 && number % 1 ? 1 : 0);
};

function niceAxisMaximum(value) {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const rounded = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return rounded * magnitude;
}

function fallbackColor(index) {
  return `hsl(${(index * 61 + 210) % 360} 62% 62%)`;
}

function drawLineChart(
  canvas,
  lines,
  durationMs,
  { height = 260, emptyText = "" } = {},
) {
  if (!canvas?.getContext) return null;
  const cssWidth = Math.max(
    360,
    Math.floor(
      canvas.parentElement?.clientWidth
      || canvas.closest?.(".chart-wrap")?.clientWidth
      || 760,
    ),
  );
  const dpr = globalThis.window?.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, cssWidth, height);

  const pad = { top: 16, right: 16, bottom: 28, left: 54 };
  const plotWidth = cssWidth - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxValue = niceAxisMaximum(Math.max(
    0,
    ...lines.flatMap(line =>
      (line.points || []).map(point => Number(point.v || 0))),
  ));
  context.font = "10px sans-serif";
  context.lineWidth = 1;
  context.textBaseline = "middle";

  for (let index = 0; index <= 5; index += 1) {
    const ratio = index / 5;
    const y = pad.top + plotHeight * (1 - ratio);
    context.strokeStyle = "rgba(255,255,255,.08)";
    context.beginPath();
    context.moveTo(pad.left, y);
    context.lineTo(cssWidth - pad.right, y);
    context.stroke();
    context.fillStyle = "#8d8d9f";
    context.textAlign = "right";
    context.fillText(chartNumber(maxValue * ratio), pad.left - 7, y);

    const x = pad.left + plotWidth * ratio;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillText(
      `${((durationMs * ratio) / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`,
      x,
      height - pad.bottom + 8,
    );
    context.textBaseline = "middle";
  }

  for (const line of lines) {
    if (!line.points?.length) continue;
    context.strokeStyle = line.color;
    context.lineWidth = 2;
    context.beginPath();
    line.points.forEach((point, index) => {
      const x = pad.left + (Number(point.t || 0) / durationMs) * plotWidth;
      const y = pad.top + (1 - Number(point.v || 0) / maxValue) * plotHeight;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }

  if (!lines.length && emptyText) {
    context.fillStyle = "#8d8d9f";
    context.textAlign = "center";
    context.fillText(
      emptyText,
      pad.left + plotWidth / 2,
      pad.top + plotHeight / 2,
    );
  }

  return {
    cssWidth,
    height,
    pad,
    plotWidth,
    plotHeight,
  };
}

function chartHtml(series, options) {
  const effects = Object.keys(series.effects || {});
  return `<div class="chart-wrap">
    <div class="chart-title">${escapeHtml(options.title)}</div>
    <div class="chart-toggles" data-role="chart-toggles">
      <label><input type="checkbox" data-series="dps" checked />
        <span class="swatch" style="background:${escapeHtml(options.dpsColor)}"></span>${escapeHtml(options.dpsLabel)}</label>
      ${effects.map((name, index) => `<label>
        <input type="checkbox" data-series="${escapeHtml(name)}" ${index < options.defaultVisibleEffectLimit ? "checked" : ""} />
        <span class="swatch" style="background:${escapeHtml(options.colors[name] || fallbackColor(index))}"></span>
        ${escapeHtml(name)}
      </label>`).join("")}
    </div>
    <div class="chart-panels">
      <div class="chart-panel">
        <div class="chart-panel-title">${escapeHtml(options.dpsLabel)} Over Time</div>
        <div class="chart-canvas-wrap">
          <canvas class="chart-canvas" data-role="dps-canvas"></canvas>
          <div class="chart-tooltip" data-role="dps-tooltip"></div>
        </div>
      </div>
      <div class="chart-panel">
        <div class="chart-panel-title">Effects Over Time</div>
        <div class="chart-canvas-wrap">
          <canvas class="chart-canvas" data-role="effects-canvas"></canvas>
          <div class="chart-tooltip" data-role="effects-tooltip"></div>
        </div>
      </div>
    </div>
  </div>`;
}

/**
 * Replaces `container` with a complete, container-scoped time-series chart.
 * Replacing the contents also makes repeated mounts safe from duplicate handlers.
 */
export function mountTimeSeriesCharts(container, series, options = {}) {
  if (!container) return null;
  const mountToken = {};
  container[ACTIVE_MOUNT] = mountToken;
  const resolvedSeries = {
    durationMs: Math.max(1, Number(series?.durationMs || 0)),
    dps: series?.dps || [],
    effects: series?.effects || {},
  };
  const resolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    colors: { ...DEFAULT_OPTIONS.colors, ...(options.colors || {}) },
  };
  container.innerHTML = chartHtml(resolvedSeries, resolvedOptions);

  const chartState = {
    dpsLayout: null,
    effectsLayout: null,
    effectLines: [],
  };
  const effectEntries = Object.entries(resolvedSeries.effects);

  const redraw = () => {
    if (container[ACTIVE_MOUNT] !== mountToken) return;
    const selected = new Set(
      [...(container.querySelectorAll?.(
        '[data-role="chart-toggles"] input:checked',
      ) || [])].map(input => input.dataset.series),
    );
    chartState.dpsLayout = drawLineChart(
      container.querySelector?.('[data-role="dps-canvas"]'),
      selected.has("dps")
        ? [{
          name: resolvedOptions.dpsLabel,
          color: resolvedOptions.dpsColor,
          points: resolvedSeries.dps,
        }]
        : [],
      resolvedSeries.durationMs,
      { height: 280, emptyText: resolvedOptions.emptyEffectsText },
    );
    chartState.effectLines = effectEntries
      .filter(([name]) => selected.has(name))
      .map(([name, points], index) => ({
        name,
        points,
        color: resolvedOptions.colors[name] || fallbackColor(index),
      }));
    chartState.effectsLayout = drawLineChart(
      container.querySelector?.('[data-role="effects-canvas"]'),
      chartState.effectLines,
      resolvedSeries.durationMs,
      { height: 260, emptyText: resolvedOptions.emptyEffectsText },
    );
  };

  const bindHover = (canvasRole, tooltipRole, kind) => {
    const canvas = container.querySelector?.(`[data-role="${canvasRole}"]`);
    const tooltip = container.querySelector?.(`[data-role="${tooltipRole}"]`);
    if (!canvas || !tooltip) return;

    canvas.onmouseleave = () => {
      tooltip.style.display = "none";
    };
    canvas.onmousemove = event => {
      const layout = kind === "dps"
        ? chartState.dpsLayout
        : chartState.effectsLayout;
      if (!layout) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = layout.cssWidth / Math.max(1, rect.width);
      const scaleY = layout.height / Math.max(1, rect.height);
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const chartX = pointerX * scaleX;
      const chartY = pointerY * scaleY;
      const minX = layout.pad.left;
      const maxX = layout.cssWidth - layout.pad.right;
      const minY = layout.pad.top;
      const maxY = layout.pad.top + layout.plotHeight;

      if (chartX < minX || chartX > maxX || chartY < minY || chartY > maxY) {
        tooltip.style.display = "none";
        return;
      }

      const time = Math.max(
        0,
        Math.min(
          resolvedSeries.durationMs,
          ((chartX - minX) / layout.plotWidth) * resolvedSeries.durationMs,
        ),
      );
      const timeLabel = `${(time / 1000).toFixed(2)}s`;
      let body;
      if (kind === "dps") {
        const dps = Math.round(chartValueAt(resolvedSeries.dps, time));
        body = `<div>${escapeHtml(resolvedOptions.dpsLabel)}: ${dps.toLocaleString()}</div>`;
      } else {
        const entries = chartState.effectLines
          .map(line => ({
            name: line.name,
            value: Math.round(chartValueAt(line.points, time)),
          }))
          .filter(entry => entry.value > 0);
        body = entries.length
          ? entries.map(entry =>
            `<div>${escapeHtml(entry.name)}: ${entry.value}</div>`).join("")
          : "<div>No visible stack effects</div>";
      }

      tooltip.innerHTML = `<div><b>${timeLabel}</b></div>${body}`;
      tooltip.style.left = `${pointerX + 12}px`;
      tooltip.style.top = `${pointerY + 12}px`;
      tooltip.style.display = "block";
    };
  };

  for (const input of container.querySelectorAll?.(
    '[data-role="chart-toggles"] input',
  ) || []) {
    input.onchange = redraw;
  }
  bindHover("dps-canvas", "dps-tooltip", "dps");
  bindHover("effects-canvas", "effects-tooltip", "effects");
  redraw();
  globalThis.requestAnimationFrame?.(redraw);
  return { redraw };
}
