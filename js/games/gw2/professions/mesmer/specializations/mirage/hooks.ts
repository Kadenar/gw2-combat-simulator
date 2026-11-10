/** Register Mirage's action owner alongside its buff projections. */
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { mirageBuffPolicies } from '#gw2/professions/mesmer/specializations/mirage/effect-state.js';
import { mirageActionLifecycle } from '#gw2/professions/mesmer/specializations/mirage/mechanics/cloak-and-ambushes.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

export const mirageHooks = composeRuntimeHooks<MesmerRuntimeState, MesmerSkill>([
  mirageActionLifecycle,
  { buffPolicies: (runtime) => mirageBuffPolicies(runtime.helpers) }
]);
