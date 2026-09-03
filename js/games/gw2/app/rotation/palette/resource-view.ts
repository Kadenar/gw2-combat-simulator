/**
 * Renders normalized profession resource views in the rotation builder.
 *
 * `activeResourceGroup` creates the read-only post-simulation display shown in
 * the palette. `renderStartResource` mounts the editable starting-resource,
 * weapon-set, and fixed-loadout controls. Profession modules provide the view
 * models; `resourceDisplayViews` clamps their values and supplies defaults
 * before this module turns them into bars, counters, or pips.
 *
 * A resource's sanitized `pipStyle` becomes a CSS class on its pips, bars, or
 * counter. This is the supported hook for profession-specific visuals such as
 * Mesmer notes and Revenant affinity emblems. Pip capacity is also exposed so
 * density can follow the resource shape without specialization selectors.
 */
import type { ProfessionResourceView, SchedulerRecord, SkillId } from '#gw2/platform/engine/types.js';
import type { ProfessionAppContract, ProfessionAppState } from '#gw2/app/types.js';
import { escapeHtml as esc } from '#gw2/app/presentation/shared/html.js';
import {
  activeSpecialization,
  paletteEndState,
  paletteProfessionState,
  professionEndState
} from '#gw2/app/rotation/shared/context.js';

export interface PaletteResourceView {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly maximum: number;
}

function normalizeResourceView(view: ProfessionResourceView): ProfessionResourceView {
  const maximum = Math.max(0, Number(view.maximum || 0));
  const displayMode =
    typeof view.displayMode === 'string' && ['bar', 'counter', 'pips', 'status'].includes(view.displayMode)
      ? view.displayMode
      : maximum > 20
        ? 'bar'
        : 'pips';
  const value = Math.max(0, Math.min(maximum, Number(view.value || 0)));
  const pipStyle = String(view.pipStyle || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  const statusItems = Array.isArray(view.statusItems)
    ? view.statusItems.map((item) => ({
        id: String(item.id || item.label || 'status'),
        label: String(item.label || item.id || 'Status'),
        valueLabel: String(item.valueLabel || ''),
        title: String(item.title || '')
      }))
    : [];
  return {
    id: String(view.id || 'resource'),
    singular: String(view.singular || 'resource'),
    plural: String(view.plural || `${view.singular || 'resource'}s`),
    maximum,
    value: displayMode === 'pips' ? Math.floor(value) : value,
    startMaximum: Math.max(0, Number(view.startMaximum ?? maximum)),
    startValue: Math.max(0, Number(view.startValue ?? view.value ?? 0)),
    canStart: view.canStart !== false,
    buildKey: String(view.buildKey || 'initialResource'),
    step: Math.max(0.01, Number(view.step || 1)),
    // Dense resources default to a bar; small discrete resources use pips.
    displayMode,
    barSegments: Math.max(1, Math.min(maximum || 1, Math.round(Number(view.barSegments || 1)))),
    pipStyle,
    pipRows: Math.max(1, Math.min(maximum || 1, Math.round(Number(view.pipRows || 1)))),
    shortLabel: String(view.shortLabel || view.singular || 'Res'),
    statusLabel: String(view.statusLabel || 'Current'),
    statusItemsLabel: String(view.statusItemsLabel || ''),
    statusItems,
    showInPalette: view.showInPalette !== false,
    showValue: view.showValue !== false,
    ...(view.paletteSkillId != null ? { paletteSkillId: view.paletteSkillId } : {})
  };
}

/**
 * Resolves and normalizes every profession-owned resource declaration before
 * the rotation palette renders it or exposes it as a starting-state control.
 */
export function resourceDisplayViews(
  profession: ProfessionAppContract,
  context: SchedulerRecord
): ProfessionResourceView[] {
  const views = profession.ui.resourceViews(context);
  if (!Array.isArray(views)) {
    throw new TypeError('Profession resourceViews must return an array.');
  }

  return views.filter((view): view is ProfessionResourceView => view != null).map(normalizeResourceView);
}

/** Formats a finite resource value with at most three decimal places. */
export function formatResourceValue(value: unknown): string {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '0';
  return String(Math.round((numeric + Number.EPSILON) * 1000) / 1000);
}

function activeResourceDefinitions(app: ProfessionAppState): ProfessionResourceView[] {
  const professionState = paletteProfessionState(app);
  const specialization =
    typeof app.adapter?.eliteSpecialization === 'function'
      ? activeSpecialization(app)
      : String(app.build?.specialization || 'Core');
  return resourceDisplayViews(app.profession, {
    specialization,
    build: app.build,
    // Profession views use scheduler seconds for their live cooldown labels.
    simulationTime: Number(paletteEndState(app)?.time || 0) / 1000,
    value: professionState.resource ?? app.build?.initialResource,
    professionState,
    initialResource: app.build?.initialResource,
    initialBlight: app.build?.initialBlight,
    initialCascadingCorruptionStacks: app.build?.initialCascadingCorruptionStacks
  }).filter((definition) => definition.showInPalette !== false);
}

/** Returns the live resource meter attached to a rotation-palette skill. */
export function paletteSkillResourceView(app: ProfessionAppState, skillId: SkillId): PaletteResourceView | null {
  // Some isolated palette consumers project skills without a profession.
  if (!app.profession?.ui) return null;
  const definition = activeResourceDefinitions(app).find(
    (candidate) => candidate.paletteSkillId != null && String(candidate.paletteSkillId) === String(skillId)
  );
  if (!definition) return null;
  return {
    id: definition.id,
    label: `${definition.statusLabel} ${definition.plural}: ${formatResourceValue(definition.value)}/${definition.maximum}`,
    value: definition.value,
    maximum: definition.maximum
  };
}

/** Distributes uneven totals into lower rows so the final pip lands at bottom-right. */
function resourcePipRows(maximum: number, rowCount: number): number[] {
  const rows: number[] = [];
  let remaining = maximum;
  for (let row = 0; row < rowCount; row += 1) {
    const count = Math.floor(remaining / (rowCount - row));
    rows.push(count);
    remaining -= count;
  }

  return rows;
}

/**
 * Rows the pip lattice shifts right by half a pip so the rows interlock. Must
 * mirror the `margin-left` offsets in `.thief-initiative .resource-pip-row`:
 * the top row nests over a two-row lattice, the middle row nests within three.
 */
function offsetPipRows(rowCount: number): ReadonlySet<number> {
  if (rowCount === 2) return new Set([0]);
  if (rowCount === 3) return new Set([1]);
  return new Set();
}

/**
 * Assigns each pip its fill rank in on-screen left-to-right order. Columns are
 * two half-pitch units wide and an interlocking (offset) row adds one, so
 * sorting by that x — tie-broken top-to-bottom — makes the active state advance
 * across the zigzag rather than lighting an entire row before the next begins.
 * Single-row resources keep their natural left-to-right order.
 */
function pipFillRanks(rows: readonly number[]): number[][] {
  const offsetRows = offsetPipRows(rows.length);
  const cells: { row: number; col: number; x: number }[] = [];
  rows.forEach((count, row) => {
    const offset = offsetRows.has(row) ? 1 : 0;
    for (let col = 0; col < count; col += 1) {
      cells.push({ row, col, x: col * 2 + offset });
    }
  });
  cells.sort((a, b) => a.x - b.x || a.row - b.row);
  const ranks = rows.map((count) => new Array<number>(count));
  cells.forEach((cell, rank) => {
    ranks[cell.row][cell.col] = rank;
  });
  return ranks;
}

function resourcePipsHtml(
  definition: ProfessionResourceView,
  value: number,
  { interactive = false }: { readonly interactive?: boolean } = {}
): string {
  const pipClass = definition.pipStyle ? ` ${esc(definition.pipStyle)}` : '';
  const pipRows = Number(definition.pipRows || 1);
  const rows = resourcePipRows(definition.maximum, pipRows);
  const fillRank = pipFillRanks(rows);
  const content = rows
    .map((count, row) => {
      const pips = Array.from({ length: count }, (_, col) => {
        const rank = fillRank[row][col];
        const stateClass = rank < value ? ' active' : '';
        const label = rank + 1;
        if (!interactive) {
          return `<span class="active-resource-pip${stateClass}"></span>`;
        }

        return `<button class="resource-pip${stateClass}"
                data-count="${label}" data-resource-key="${esc(definition.buildKey)}"
                title="${label} ${esc(definition.plural)}"></button>`;
      }).join('');
      return pipRows > 1 ? `<span class="resource-pip-row">${pips}</span>` : pips;
    })
    .join('');
  return `<div class="${
    interactive ? 'resource-pips' : 'active-resource-pips'
  }${pipClass} pip-rows-${pipRows} pip-count-${Math.floor(definition.maximum)}">${content}</div>`;
}

function resourceBarsHtml(definition: ProfessionResourceView, value: number): string {
  const segmentCount = Math.max(1, Number(definition.barSegments || 1));
  const segmentMaximum = definition.maximum / segmentCount;
  const barClass = definition.pipStyle ? ` ${esc(definition.pipStyle)}` : '';
  const bars = Array.from({ length: segmentCount }, (_, index) => {
    const segmentValue = Math.max(0, Math.min(segmentMaximum, value - index * segmentMaximum));
    const width = segmentMaximum ? (segmentValue / segmentMaximum) * 100 : 0;
    return `<div class="active-resource-bar${barClass}"><span style="width:${width}%"></span></div>`;
  }).join('');
  return segmentCount > 1
    ? `<div class="active-resource-bars" style="--resource-bar-segments:${segmentCount}">${bars}</div>`
    : bars;
}

function resourceCounterHtml(definition: ProfessionResourceView, value: number): string {
  const counterClass = definition.pipStyle ? ` ${esc(definition.pipStyle)}` : '';
  return `<div class="active-resource-counter${counterClass}" aria-hidden="true">
      <span>${esc(formatResourceValue(value))}</span>
    </div>`;
}

function resourceStatusItemsHtml(definition: ProfessionResourceView): string {
  const items = definition.statusItems || [];
  if (!items.length) return '';
  const label = definition.statusItemsLabel || '';
  // An empty visible label intentionally produces a chips-only row while the
  // resource status remains available to assistive technology.
  const ariaLabel = label || definition.statusLabel || 'Status';
  return `<div class="active-resource-statuses"
      aria-label="${esc(ariaLabel)}">
      ${label ? `<span class="active-resource-statuses-label">${esc(label)}</span>` : ''}
      ${items
        .map((item) => {
          const title = item.title || `${item.label} ${item.valueLabel || ''}`;
          return `<span class="active-resource-status" title="${esc(title.trim())}">
          <span>${esc(item.label)}</span>
          ${item.valueLabel ? `<strong>${esc(item.valueLabel)}</strong>` : ''}
        </span>`;
        })
        .join('')}
    </div>`;
}

/**
 * Returns the read-only resource HTML for the latest simulation end state.
 * Multiple resource views are wrapped in an `active-resource-stack`.
 */
export function activeResourceGroup(
  app: ProfessionAppState,
  {
    includeIds,
    excludeIds
  }: {
    readonly includeIds?: readonly string[];
    readonly excludeIds?: readonly string[];
  } = {}
): string {
  const included = includeIds ? new Set(includeIds.map(String)) : null;
  const excluded = new Set((excludeIds || []).map(String));
  const definitions = activeResourceDefinitions(app).filter(
    (definition) =>
      definition.paletteSkillId == null && (!included || included.has(definition.id)) && !excluded.has(definition.id)
  );
  const groups = definitions
    .map((definition) => {
      if (definition.displayMode === 'status') {
        return `<div class="pal-group active-resource-group active-resource-status-only"
            data-resource-id="${esc(definition.id)}">${resourceStatusItemsHtml(definition)}</div>`;
      }

      const buildValue = definition.buildKey ? app.build[definition.buildKey] : 0;
      const value = Math.max(0, Math.min(definition.maximum, Number(definition.value ?? buildValue)));
      const displayValue = formatResourceValue(value);
      const valueLabel = `${definition.statusLabel} ${definition.plural}: ${displayValue}/${definition.maximum}`;
      const title = definition.showValue === false ? `${definition.statusLabel} ${definition.plural}` : valueLabel;
      const indicator =
        definition.displayMode === 'bar'
          ? resourceBarsHtml(definition, value)
          : definition.displayMode === 'counter'
            ? resourceCounterHtml(definition, value)
            : resourcePipsHtml(definition, value);
      // Bars and pips need their numeric value for precise resource tracking;
      // counters already render the value inside their own indicator.
      const visibleValue =
        definition.displayMode === 'counter' || definition.showValue === false
          ? ''
          : `<strong>${displayValue}/${definition.maximum}</strong>`;
      return `<div class="pal-group active-resource-group">
            <div class="pal-label" style="color:#c49cff">${esc(definition.shortLabel)}</div>
            <div class="active-resource" data-resource-id="${esc(definition.id)}"
                data-resource-count="${value}" title="${esc(title)}"
                aria-label="${esc(valueLabel)}">
                ${indicator}
                ${visibleValue}
            </div>
            ${resourceStatusItemsHtml(definition)}
        </div>`;
    })
    .join('');
  return definitions.length > 1 ? `<div class="active-resource-stack">${groups}</div>` : groups;
}

/**
 * Mounts starting-state controls and binds them to the application build.
 *
 * Startable bars and counters use numeric inputs; startable pips use count
 * buttons. A
 * resource with `canStart: false` remains visible in the live display but has
 * no starting control. Every accepted change calls `app.changed()` so the
 * simulation and both resource displays refresh together.
 */
export function renderStartResource(app: ProfessionAppState): void {
  const element = document.getElementById('start-att-selector');
  if (!element) return;
  const professionState = professionEndState(app.results);
  const definitions = resourceDisplayViews(app.profession, {
    specialization: activeSpecialization(app),
    build: app.build,
    professionState,
    value: professionState.resource ?? app.build.initialResource,
    initialResource: app.build.initialResource,
    initialBlight: app.build.initialBlight,
    initialCascadingCorruptionStacks: app.build.initialCascadingCorruptionStacks
  });
  const startControls = app.profession.ui.startControls({
    build: app.build,
    specialization: activeSpecialization(app),
    professionState,
    catalog: app.activeCatalog
  });
  const startControlsHtml = startControls
    .map(
      (control) => `<div class="start-resource-control">
          <span class="start-att-label">${esc(control.label)}:</span>
          <div class="start-state-toggle">${control.options
            .map(
              (option) => `<button class="start-att-btn start-state-btn${
                option.value === control.value ? ' active' : ''
              }" data-start-control-key="${esc(control.buildKey)}"
                  data-start-control-value="${esc(option.value)}"
                  style="--att-c:${esc(control.color || 'var(--accent)')}"
                  title="${esc(option.description || option.label)}">
                  <img src="${esc(option.icon || '')}" alt="">
              </button>`
            )
            .join('')}</div>
      </div>`
    )
    .join('');
  const hasSecondSet = Boolean(app.build.alternateWeapons?.[0]);
  const startSet = app.build.startingWeaponSet === 2 && hasSecondSet ? 2 : 1;
  const weaponControl = hasSecondSet
    ? `<span class="start-att-label">Start weapon:</span>
        <div class="weapon-set-toggle">${[1, 2]
          .map(
            (set) =>
              `<button class="weapon-set-btn${set === startSet ? ' active' : ''}"
                data-set="${set}" title="Start on weapon set ${set}">W${set}</button>`
          )
          .join('')}</div>`
    : '';
  const slotLoadout = app.adapter.slotLoadout;
  const loadoutView = slotLoadout?.view({
    build: app.build,
    specialization: activeSpecialization(app),
    professionState,
    catalog: app.activeCatalog
  });
  const startingLoadoutId = loadoutView && slotLoadout ? app.build[slotLoadout.startingKey] : '';
  const loadoutControl = loadoutView?.bars?.length
    ? `<span class="start-att-label">Start ${esc(loadoutView.label.replace(/s$/, '').toLowerCase())}:</span>
        <div class="start-loadout-toggle">${loadoutView.bars
          .map(
            (bar) =>
              `<button class="start-att-btn start-loadout-btn${
                bar.id === startingLoadoutId ? ' active' : ''
              }" data-loadout-id="${esc(bar.id)}" style="--att-c:var(--accent)"
                title="Start with ${esc(bar.compactLabel || bar.label)}">
                <img src="${esc(bar.icon || '')}" alt="">
            </button>`
          )
          .join('')}</div>`
    : '';
  const bindStartingLoadout = (): void => {
    element.querySelectorAll<HTMLElement>('.start-loadout-btn').forEach((button) => {
      button.addEventListener('click', () => {
        if (!slotLoadout) return;
        slotLoadout.updateBuild(app.build, slotLoadout.startingKey, button.dataset.loadoutId || '', {
          build: app.build,
          specialization: activeSpecialization(app),
          professionState,
          catalog: app.activeCatalog
        });
        app.changed();
      });
    });
  };

  const bindStartControls = (): void => {
    element.querySelectorAll<HTMLElement>('.start-state-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.startControlKey;
        const value = button.dataset.startControlValue;
        if (!key || value == null) return;
        app.build[key] = value;
        app.changed();
      });
    });
  };

  if (!definitions.length) {
    element.innerHTML = `${weaponControl}${loadoutControl}${startControlsHtml}`;
    element.querySelectorAll<HTMLElement>('.weapon-set-btn').forEach((button) => {
      button.addEventListener('click', () => {
        app.build.startingWeaponSet = Number(button.dataset.set);
        app.changed();
      });
    });
    bindStartingLoadout();
    bindStartControls();
    return;
  }

  const resourceControls = definitions
    .map((definition) => {
      if (definition.canStart === false) return '';
      const key = definition.buildKey || 'initialResource';
      const startMaximum = Number(definition.startMaximum ?? definition.maximum);
      const value = Math.max(0, Math.min(startMaximum, Number(app.build[key] || 0)));
      if (definition.displayMode === 'bar' || definition.displayMode === 'counter') {
        return `<div class="start-resource-control start-resource-number">
                <label class="start-att-label">
                    Start ${esc(definition.plural)}:
                </label>
                <input type="number" min="0" max="${startMaximum}"
                    step="${definition.step}" value="${value}"
                    data-resource-key="${esc(key)}">
            </div>`;
      }

      return `<div class="start-resource-control">
            <span class="start-att-label">Start ${esc(definition.plural)}:</span>
            ${resourcePipsHtml(definition, value, { interactive: true })}
        </div>`;
    })
    .join('');
  // Keep related resource controls in one styling hook while preserving the default inline layout through display: contents.
  const resourceControlsHtml = resourceControls ? `<div class="start-resource-controls">${resourceControls}</div>` : '';
  element.innerHTML = `${weaponControl}${loadoutControl}${startControlsHtml}${resourceControlsHtml}`;
  element.querySelectorAll<HTMLElement>('.resource-pip').forEach((button) => {
    button.addEventListener('click', () => {
      const count = Number(button.dataset.count);
      const key = button.dataset.resourceKey || 'initialResource';
      app.build[key] = count === app.build[key] ? count - 1 : count;
      app.changed();
    });
  });
  element.querySelectorAll<HTMLInputElement>('input[data-resource-key]').forEach((input) => {
    input.addEventListener('change', () => {
      const key = input.dataset.resourceKey || 'initialResource';
      app.build[key] = Math.max(Number(input.min || 0), Math.min(Number(input.max), Number(input.value) || 0));
      app.changed();
    });
  });
  element.querySelectorAll<HTMLElement>('.weapon-set-btn').forEach((button) => {
    button.addEventListener('click', () => {
      app.build.startingWeaponSet = Number(button.dataset.set);
      app.changed();
    });
  });
  bindStartingLoadout();
  bindStartControls();
}
