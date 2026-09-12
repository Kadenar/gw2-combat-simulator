import {
  normalizeTransitionDelays,
  TRANSITION_DELAY_KEYS,
  type TransitionDelays
} from '#gw2/platform/simulation/transition-delays.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

export interface SimulationSettings {
  transitionDelays: TransitionDelays;
}
export const SIMULATION_SETTINGS_STORAGE_KEY = 'gw2.simulation-settings';
const LABELS: Record<keyof TransitionDelays, string> = {
  weaponSwapMs: 'Weapon swap',
  forgeEntryMs: 'Radiant / Photon Forge entry',
  forgeExitMs: 'Radiant / Photon Forge exit',
  shroudEntryMs: 'Thief / Necromancer Shroud entry',
  shroudExitMs: 'Thief / Necromancer Shroud exit'
};

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

  for (const key of TRANSITION_DELAY_KEYS) {
    const label = root.createElement('label');
    label.className = 'boon-control';
    label.textContent = `${LABELS[key]} (ms) `;
    label.title = 'Additional input delay after the transition. Overlaps existing cast recovery. Shared across builds.';
    const input = root.createElement('input');
    input.id = `simulation-${key}`;
    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.value = String(settings.transitionDelays[key]);
    input.addEventListener('change', () => {
      settings.transitionDelays[key] = Number(input.value);
      update();
    });
    label.append(input);
    controls.append(label);
  }

  // Bulk actions persist all five delays together and rerun the simulation once.
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
    controls.append(button);
  }

  section.append(summary, controls);
  container.append(section);
}
