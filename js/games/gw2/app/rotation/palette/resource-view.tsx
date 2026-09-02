/**
 * Renders normalized profession resource views in the rotation builder.
 *
 * `ActiveResourceGroup` creates the read-only post-simulation display shown in
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
import type { PaletteResourceView } from '#gw2/app/presentation/rotation/palette.js';
import { DraftNumberInput } from '#ui/draft-number-input.js';
import { renderReact } from '#ui/react-root.js';
import {
  activeSpecialization,
  paletteEndState,
  paletteProfessionState,
  professionEndState
} from '#gw2/app/rotation/shared/context.js';

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

/** Resolves live resource declarations once so palette layout and rendering agree about empty groups. */
export function activeResourceDefinitions(app: ProfessionAppState): ProfessionResourceView[] {
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

function ResourcePips({
  definition,
  value,
  onSelect
}: {
  readonly definition: ProfessionResourceView;
  readonly value: number;
  readonly onSelect?: (count: number) => void;
}) {
  const rowCount = Number(definition.pipRows || 1);
  const rows = resourcePipRows(definition.maximum, rowCount);
  const ranks = pipFillRanks(rows);
  const classes = `${onSelect ? 'resource-pips' : 'active-resource-pips'}${
    definition.pipStyle ? ` ${definition.pipStyle}` : ''
  } pip-rows-${rowCount} pip-count-${Math.floor(definition.maximum)}`;
  return (
    <div className={classes}>
      {rows.map((count, row) => {
        const pips = Array.from({ length: count }, (_, col) => {
          const rank = ranks[row][col];
          return onSelect ? (
            <button
              key={rank}
              type='button'
              className={`resource-pip${rank < value ? ' active' : ''}`}
              data-count={rank + 1}
              data-resource-key={definition.buildKey}
              title={`${rank + 1} ${definition.plural}`}
              onClick={() => onSelect(rank + 1)}
            />
          ) : (
            <span key={rank} className={`active-resource-pip${rank < value ? ' active' : ''}`} />
          );
        });
        return rowCount > 1 ? (
          <span key={row} className='resource-pip-row'>
            {pips}
          </span>
        ) : (
          pips
        );
      })}
    </div>
  );
}

function ResourceIndicator({
  definition,
  value
}: {
  readonly definition: ProfessionResourceView;
  readonly value: number;
}) {
  if (definition.displayMode === 'bar') {
    const segmentCount = Math.max(1, Number(definition.barSegments || 1));
    const maximum = definition.maximum / segmentCount;
    const bars = Array.from({ length: segmentCount }, (_, index) => {
      const segmentValue = Math.max(0, Math.min(maximum, value - index * maximum));
      return (
        <div key={index} className={`active-resource-bar${definition.pipStyle ? ` ${definition.pipStyle}` : ''}`}>
          <span style={{ width: `${maximum ? (segmentValue / maximum) * 100 : 0}%` }} />
        </div>
      );
    });
    return segmentCount > 1 ? (
      <div className='active-resource-bars' style={{ '--resource-bar-segments': segmentCount } as React.CSSProperties}>
        {bars}
      </div>
    ) : (
      bars
    );
  }

  if (definition.displayMode === 'counter') {
    return (
      <div
        className={`active-resource-counter${definition.pipStyle ? ` ${definition.pipStyle}` : ''}`}
        aria-hidden='true'
      >
        <span>{formatResourceValue(value)}</span>
      </div>
    );
  }

  return <ResourcePips definition={definition} value={value} />;
}

function ResourceStatuses({ definition }: { readonly definition: ProfessionResourceView }) {
  if (!definition.statusItems?.length) return null;
  const label = definition.statusItemsLabel || '';
  return (
    <div className='active-resource-statuses' aria-label={label || definition.statusLabel || 'Status'}>
      {label ? <span className='active-resource-statuses-label'>{label}</span> : null}
      {definition.statusItems.map((item) => (
        <span
          key={item.id}
          className='active-resource-status'
          title={(item.title || `${item.label} ${item.valueLabel || ''}`).trim()}
        >
          <span>{item.label}</span>
          {item.valueLabel ? <strong>{item.valueLabel}</strong> : null}
        </span>
      ))}
    </div>
  );
}

/** Renders live profession resources as React-owned palette content. */
export function ActiveResourceGroup({
  app,
  includeIds,
  excludeIds
}: {
  readonly app: ProfessionAppState;
  readonly includeIds?: readonly string[];
  readonly excludeIds?: readonly string[];
}) {
  const included = includeIds ? new Set(includeIds.map(String)) : null;
  const excluded = new Set((excludeIds || []).map(String));
  const definitions = activeResourceDefinitions(app).filter(
    (definition) =>
      definition.paletteSkillId == null && (!included || included.has(definition.id)) && !excluded.has(definition.id)
  );
  const groups = definitions.map((definition) => {
    if (definition.displayMode === 'status') {
      return (
        <div
          key={definition.id}
          className='pal-group active-resource-group active-resource-status-only'
          data-resource-id={definition.id}
        >
          <ResourceStatuses definition={definition} />
        </div>
      );
    }

    const buildValue = definition.buildKey ? app.build[definition.buildKey] : 0;
    const value = Math.max(0, Math.min(definition.maximum, Number(definition.value ?? buildValue)));
    const displayValue = formatResourceValue(value);
    const valueLabel = `${definition.statusLabel} ${definition.plural}: ${displayValue}/${definition.maximum}`;
    return (
      <div key={definition.id} className='pal-group active-resource-group'>
        <div className='pal-label' style={{ color: '#c49cff' }}>
          {definition.shortLabel}
        </div>
        <div
          className='active-resource'
          data-resource-id={definition.id}
          data-resource-count={value}
          title={definition.showValue === false ? `${definition.statusLabel} ${definition.plural}` : valueLabel}
          aria-label={valueLabel}
        >
          <ResourceIndicator definition={definition} value={value} />
          {definition.displayMode !== 'counter' && definition.showValue !== false ? (
            <strong>
              {displayValue}/{definition.maximum}
            </strong>
          ) : null}
        </div>
        <ResourceStatuses definition={definition} />
      </div>
    );
  });
  return definitions.length > 1 ? <div className='active-resource-stack'>{groups}</div> : groups;
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
function StartResourceControls({ app }: { readonly app: ProfessionAppState }) {
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
  const hasSecondSet = Boolean(app.build.alternateWeapons?.[0]);
  const startSet = app.build.startingWeaponSet === 2 && hasSecondSet ? 2 : 1;
  const slotLoadout = app.adapter.slotLoadout;
  const loadoutView = slotLoadout?.view({
    build: app.build,
    specialization: activeSpecialization(app),
    professionState,
    catalog: app.activeCatalog
  });
  const startingLoadoutId = loadoutView && slotLoadout ? app.build[slotLoadout.startingKey] : '';
  const resourceControls = definitions.filter((definition) => definition.canStart !== false);
  return (
    <>
      {hasSecondSet ? (
        <>
          <span className='start-att-label'>Start weapon:</span>
          <div className='weapon-set-toggle'>
            {[1, 2].map((set) => (
              <button
                key={set}
                type='button'
                className={`weapon-set-btn${set === startSet ? ' active' : ''}`}
                data-set={set}
                title={`Start on weapon set ${set}`}
                onClick={() => {
                  app.build.startingWeaponSet = set;
                  app.changed();
                }}
              >
                W{set}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {loadoutView?.bars?.length ? (
        <>
          <span className='start-att-label'>Start {loadoutView.label.replace(/s$/, '').toLowerCase()}:</span>
          <div className='start-loadout-toggle'>
            {loadoutView.bars.map((bar) => (
              <button
                key={bar.id}
                type='button'
                className={`start-att-btn start-loadout-btn${bar.id === startingLoadoutId ? ' active' : ''}`}
                data-loadout-id={bar.id}
                style={{ '--att-c': 'var(--accent)' } as React.CSSProperties}
                title={`Start with ${bar.compactLabel || bar.label}`}
                onClick={() => {
                  if (!slotLoadout) return;
                  slotLoadout.updateBuild(app.build, slotLoadout.startingKey, bar.id, {
                    build: app.build,
                    specialization: activeSpecialization(app),
                    professionState,
                    catalog: app.activeCatalog
                  });
                  app.changed();
                }}
              >
                <img src={bar.icon || ''} alt='' />
              </button>
            ))}
          </div>
        </>
      ) : null}
      {startControls.map((control) => (
        <div key={control.buildKey} className='start-resource-control'>
          <span className='start-att-label'>{control.label}:</span>
          <div className='start-state-toggle'>
            {control.options.map((option) => (
              <button
                key={option.value}
                type='button'
                className={`start-att-btn start-state-btn${option.value === control.value ? ' active' : ''}`}
                data-start-control-key={control.buildKey}
                data-start-control-value={option.value}
                style={{ '--att-c': control.color || 'var(--accent)' } as React.CSSProperties}
                title={option.description || option.label}
                onClick={() => {
                  app.build[control.buildKey] = option.value;
                  app.changed();
                }}
              >
                <img src={option.icon || ''} alt='' />
              </button>
            ))}
          </div>
        </div>
      ))}
      {resourceControls.length ? (
        <div className='start-resource-controls'>
          {resourceControls.map((definition) => {
            const key = definition.buildKey || 'initialResource';
            const maximum = Number(definition.startMaximum ?? definition.maximum);
            const value = Math.max(0, Math.min(maximum, Number(app.build[key] || 0)));
            const commit = (nextValue: number): void => {
              app.build[key] = nextValue;
              app.changed();
            };

            return definition.displayMode === 'bar' || definition.displayMode === 'counter' ? (
              <div key={definition.id} className='start-resource-control start-resource-number'>
                <label className='start-att-label'>Start {definition.plural}:</label>
                <DraftNumberInput
                  min={0}
                  max={maximum}
                  step={definition.step}
                  value={value}
                  data-resource-key={key}
                  onCommit={(draft) => {
                    const next = Math.max(0, Math.min(maximum, Number(draft) || 0));
                    commit(next);
                    return next;
                  }}
                />
              </div>
            ) : (
              <div key={definition.id} className='start-resource-control'>
                <span className='start-att-label'>Start {definition.plural}:</span>
                <ResourcePips
                  definition={definition}
                  value={value}
                  onSelect={(count) => commit(count === app.build[key] ? count - 1 : count)}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

/** Mounts React-owned starting-state controls into their stable document container. */
export function renderStartResource(app: ProfessionAppState): void {
  const element = document.getElementById('start-att-selector');
  if (element) renderReact(element, <StartResourceControls app={app} />);
}
