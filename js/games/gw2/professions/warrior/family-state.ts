import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';
import type { WarriorRuntimeState } from '#gw2/professions/warrior/types.js';
import {
  composePublicStateProjections,
  projectPublicProfessionState,
  snapshotProfessionState
} from '#gw2/platform/engine/profession/state.js';
import type { WarriorState } from '#gw2/professions/warrior/types.js';
import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import { WARRIOR_CORE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/warrior/core/state.js';
import { BERSERKER_PUBLIC_STATE_PROJECTION } from '#gw2/professions/warrior/specializations/berserker/state.js';
import { BLADESWORN_PUBLIC_STATE_PROJECTION } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import { PARAGON_PUBLIC_STATE_PROJECTION } from '#gw2/professions/warrior/specializations/paragon/state.js';
import { SPELLBREAKER_PUBLIC_STATE_PROJECTION } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';

/** Aggregates Core and active-specialization state at the Warrior family boundary. */
export function snapshotWarriorState(state: unknown, skillsById: CanonicalCatalog['skillsById']): WarriorState {
  const snapshot = snapshotProfessionState<WarriorState>(state);
  // Keep public/UI labels derived from the current catalog, never used as mechanic identity.
  snapshot.activeRefrain = snapshot.activeRefrainId == null ? '' : skillsById.get(snapshot.activeRefrainId)?.name || '';
  return snapshot;
}

// Compose public metadata once; runtime initialization and resolver ownership stay with each slice.
const WARRIOR_PUBLIC_STATE_PROJECTION = composePublicStateProjections([
  WARRIOR_CORE_PUBLIC_STATE_PROJECTION,
  BERSERKER_PUBLIC_STATE_PROJECTION,
  SPELLBREAKER_PUBLIC_STATE_PROJECTION,
  BLADESWORN_PUBLIC_STATE_PROJECTION,
  PARAGON_PUBLIC_STATE_PROJECTION
]);

export const WARRIOR_PUBLIC_END_STATE_KEYS = WARRIOR_PUBLIC_STATE_PROJECTION.keys;

/** Projects the stable public end state after the active slice has been flattened. */
export function projectWarriorPlanningState({
  profession,
  catalog
}: Gw2PlanningStateInput<WarriorRuntimeState>): Record<string, unknown> {
  const state = snapshotWarriorState(profession, catalog.skillsById);
  return projectPublicProfessionState(state, WARRIOR_PUBLIC_END_STATE_KEYS, WARRIOR_PUBLIC_STATE_PROJECTION.defaults);
}
