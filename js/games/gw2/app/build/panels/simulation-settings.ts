import { applyTransitionDelays } from '#gw2/app/simulation/settings.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { TRANSITION_DELAY_KEYS, type TransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';

/** Delay edits affect the active workspace and invalidate only its dependent build tabs. */
export function mountSimulationSettings(app: ProfessionAppState, root: Document = document): void {
  const container = root.getElementById('simulation-options');

  if (!container) return;

  container.querySelector('#simulation-transition-delays')?.remove();
  const section = root.createElement('details');
  section.id = 'simulation-transition-delays';
  section.className = 'perma-group';
  section.open = true;
  const summary = root.createElement('summary');
  summary.className = 'perma-group-label';
  summary.textContent = 'Transition delays';
  const controls = root.createElement('div');
  controls.className = 'perma-group-content';
  const settings = app.workspace!.simulationSettings;
  const update = (delays: TransitionDelays): void => {
    // Manual edits and accepted imports share persistence and cache invalidation.
    if (applyTransitionDelays(app, delays)) app.changed();
  };

  // Pair entry and exit delays so each transition can be compared and edited on one row.
  const table = root.createElement('table');
  table.className = 'transition-delay-table';
  table.innerHTML = `<caption>All delays in ms</caption>
    <thead><tr><th scope="col">Transition</th><th scope="col">Entry</th><th scope="col">Exit</th></tr></thead>`;
  const body = table.createTBody();
  for (const [name, entry, exit] of [
    ['Weapon swap / Gunsaber', 'weaponSwapMs', null],
    ['Radiant / Photon Forge', 'forgeEntryMs', 'forgeExitMs'],
    ['Thief / Necromancer Shroud', 'shroudEntryMs', 'shroudExitMs']
  ] as const) {
    const row = body.insertRow();
    const heading = root.createElement('th');
    heading.scope = 'row';
    heading.textContent = name;
    row.append(heading);
    for (const [key, direction] of [
      [entry, 'entry'],
      [exit, 'exit']
    ] as const) {
      const cell = row.insertCell();

      if (!key) {
        cell.textContent = '—';
        continue;
      }

      const input = root.createElement('input');
      input.id = `simulation-${key}`;
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.value = String(settings.transitionDelays[key]);
      input.setAttribute('aria-label', `${name}${key === 'weaponSwapMs' ? '' : ` ${direction}`} (ms)`);
      input.title =
        'Additional input delay after the transition. Overlaps existing cast recovery. Applies within this workspace.';
      input.addEventListener('change', () => {
        update({ ...settings.transitionDelays, [key]: Number(input.value) });
        input.value = String(settings.transitionDelays[key]);
      });
      cell.append(input);
    }
  }

  controls.append(table);

  // Bulk actions persist all five delays together and rerun the simulation once.
  const actions = root.createElement('div');
  actions.className = 'transition-delay-actions';
  for (const [label, delay] of [
    ['Apply 100 ms to all', 100],
    ['Clear all', 0]
  ] as const) {
    const button = root.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = label;
    button.addEventListener('click', () => {
      const delays = { ...settings.transitionDelays };
      for (const key of TRANSITION_DELAY_KEYS) delays[key] = delay;
      update(delays);
    });
    actions.append(button);
  }

  controls.append(actions);

  section.append(summary, controls);
  container.append(section);
}
