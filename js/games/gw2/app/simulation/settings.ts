import { normalizeTransitionDelays, type TransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';

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

/** Persist normalized browser preferences so every build and workspace tab shares the same simulation inputs. */
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
