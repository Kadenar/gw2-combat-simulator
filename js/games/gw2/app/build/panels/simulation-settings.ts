import {
  normalizeTransitionDelays,
  TRANSITION_DELAY_KEYS,
  type TransitionDelays
} from '#gw2/platform/skills/transition-delays.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

export interface SimulationSettings {
  transitionDelays: TransitionDelays;
}
export const SIMULATION_SETTINGS_STORAGE_KEY = 'gw2.simulation-settings';

/** Simulation preferences belong to this browser, independent of builds, presets, and workspace tabs. */
export function loadSimulationSettings(): SimulationSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SIMULATION_SETTINGS_STORAGE_KEY) || 'null');
    return { transitionDelays: normalizeTransitionDelays(saved?.transitionDelays) };
  } catch {
    return { transitionDelays: normalizeTransitionDelays(null) };
  }
}

export function saveSimulationSettings(settings: SimulationSettings): void {
  try {
    localStorage.setItem(
      SIMULATION_SETTINGS_STORAGE_KEY,
      JSON.stringify({ transitionDelays: normalizeTransitionDelays(settings.transitionDelays) })
    );
  } catch {
    // Storage restrictions must not prevent the current session from using its simulation settings.
  }
}

/** Mount native numeric inputs outside build assumptions; changing them reruns every dependent simulation. */
export function mountSimulationSettings(app: ProfessionAppState, root: Document = document): void {
  const container = root.getElementById('perma-boons');
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
  const settings = (app.simulationSettings ??= loadSimulationSettings());
  const update = (): void => {
    settings.transitionDelays = normalizeTransitionDelays(settings.transitionDelays);
    saveSimulationSettings(settings);
    app.changed();
  };

  // Pair entry and exit delays so each transition can be compared and edited on one row.
  const table = root.createElement('table');
  table.className = 'transition-delay-table';
  table.innerHTML = `<caption>All delays in ms</caption>
    <thead><tr><th scope="col">Transition</th><th scope="col">Entry</th><th scope="col">Exit</th></tr></thead>`;
  const body = table.createTBody();
  for (const [name, entry, exit] of [
    ['Weapon swap', 'weaponSwapMs', null],
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
        'Additional input delay after the transition. Overlaps existing cast recovery. Shared across builds.';
      input.addEventListener('change', () => {
        settings.transitionDelays[key] = Number(input.value);
        update();
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
      for (const key of TRANSITION_DELAY_KEYS) settings.transitionDelays[key] = delay;
      update();
    });
    actions.append(button);
  }

  controls.append(actions);

  section.append(summary, controls);
  container.append(section);
}
