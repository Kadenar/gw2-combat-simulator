import { normalizeTransitionDelays, type TransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';

export interface SimulationSettings {
  transitionDelays: TransitionDelays;
}

export const SIMULATION_SETTINGS_STORAGE_KEY = 'gw2.simulation-settings';

/** New encounter workspaces start with their own delays rather than copying Golem preferences. */
export function defaultSimulationSettings(): SimulationSettings {
  return { transitionDelays: normalizeTransitionDelays(null) };
}

/** Restore Golem preferences; boss scenarios persist their settings inside their own documents. */
export function loadSimulationSettings(): SimulationSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SIMULATION_SETTINGS_STORAGE_KEY) || 'null');
    return { transitionDelays: normalizeTransitionDelays(saved?.transitionDelays) };
  } catch {
    return { transitionDelays: normalizeTransitionDelays(null) };
  }
}

/** Persist Golem preferences shared by its build tabs, independently of boss scenario settings. */
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
