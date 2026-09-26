import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';
import type { NecromancerRuntimeState } from '#gw2/professions/necromancer/types.js';
import { cappedResource } from '#gw2/platform/combat/resources/pool.js';
import {
  composePublicStateProjections,
  flattenProfessionState,
  projectPublicProfessionState
} from '#gw2/platform/engine/profession/state.js';

import { NECROMANCER_CORE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/necromancer/core/state.js';
import {
  HARBINGER_PUBLIC_STATE_PROJECTION,
  syncHarbingerState
} from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { RITUALIST_PUBLIC_STATE_PROJECTION } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { SCOURGE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/necromancer/specializations/scourge/state.js';
import type { NecromancerState } from '#gw2/professions/necromancer/types.js';

/** Normalize a shallow candidate; emission and public projection detach only the state they retain. */
function flattenNecromancerState(state: unknown): NecromancerState {
  const flattened = flattenProfessionState<NecromancerState>(state);
  // Reporting clamps a detached pool without rewriting the live resource or its accrual anchor.
  flattened.lifeForce = {
    ...flattened.lifeForce,
    value: cappedResource(flattened.lifeForce.value, flattened.lifeForce.maximum)
  };
  if (Object.hasOwn(flattened, 'blightExpiries')) syncHarbingerState(flattened);
  return flattened;
}

// Compose public metadata once; runtime initialization and resolver ownership stay with each slice.
const NECROMANCER_PUBLIC_STATE_PROJECTION = composePublicStateProjections([
  NECROMANCER_CORE_PUBLIC_STATE_PROJECTION,
  SCOURGE_PUBLIC_STATE_PROJECTION,
  HARBINGER_PUBLIC_STATE_PROJECTION,
  RITUALIST_PUBLIC_STATE_PROJECTION
]);

export const NECROMANCER_PUBLIC_END_STATE_KEYS = NECROMANCER_PUBLIC_STATE_PROJECTION.keys;

/** Projects the observed resource state without replay or access to an execution controller. */
export function projectNecromancerPlanningState({
  profession
}: Gw2PlanningStateInput<NecromancerRuntimeState>): Record<string, unknown> {
  const state = flattenNecromancerState(profession);
  return projectPublicProfessionState(
    state,
    NECROMANCER_PUBLIC_END_STATE_KEYS,
    NECROMANCER_PUBLIC_STATE_PROJECTION.defaults
  );
}
