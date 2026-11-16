/** Owns simulation preference defaults and storage independently of workspace changes. */
import { normalizeConditionTickOffsetMs } from '#gw2/platform/combat/condition-clock.js';
import { normalizeTransitionDelays, type TransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';

export interface SimulationSettings {
  transitionDelays: TransitionDelays;
  conditionTickOffsetMs: number;
}

export const SIMULATION_SETTINGS_STORAGE_KEY = 'gw2.simulation-settings';

/** New encounter workspaces start with their own delays rather than copying Golem preferences. */
export function defaultSimulationSettings(): SimulationSettings {
  return { transitionDelays: normalizeTransitionDelays(null), conditionTickOffsetMs: 0 };
}

/** Restore Golem preferences; boss scenarios persist their settings inside their own documents. */
export function loadSimulationSettings(): SimulationSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SIMULATION_SETTINGS_STORAGE_KEY) || 'null');
    return normalizeSimulationSettings(saved);
  } catch {
    return defaultSimulationSettings();
  }
}

/** Persist Golem preferences shared by its build tabs, independently of boss scenario settings. */
export function saveSimulationSettings(settings: SimulationSettings): void {
  try {
    localStorage.setItem(SIMULATION_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeSimulationSettings(settings)));
  } catch {
    // Storage restrictions must not prevent the current session from using its simulation settings.
  }
}

/** Detach all workspace simulation inputs for storage, workers, and comparison cache keys. */
export function normalizeSimulationSettings(value?: Partial<SimulationSettings> | null): SimulationSettings {
  return {
    transitionDelays: normalizeTransitionDelays(value?.transitionDelays),
    conditionTickOffsetMs: normalizeConditionTickOffsetMs(value?.conditionTickOffsetMs)
  };
}
