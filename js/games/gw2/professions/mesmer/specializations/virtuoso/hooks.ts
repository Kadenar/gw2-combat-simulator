import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { virtuosoAvailability } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/bladesongs.js';
import { initializeVirtuosoRuntime } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/runtime.js';
import { resolveBladeCriticalTraits } from '#gw2/professions/mesmer/specializations/virtuoso/traits/behavior.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

/** Blade resources follow committed spending, accepted Bleeding, and actual shared critical outcomes. */
export const virtuosoHooks: Partial<RuntimeProfession<MesmerRuntimeState, MesmerSkill>> = {
  initialize: initializeVirtuosoRuntime,
  availability: virtuosoAvailability,
  tasks: {
    'mesmer.blade-spend'(runtime, data) {
      const mechanics = mesmerMechanicsFor(runtime);
      const details = runtime.profession.core.castDetails.get(String(data));
      if (!details || details.shatterSpendCommitted) return;
      details.shatterSpent = mechanics.actions.commitReservedResources(runtime.time, details.shatterSpent ?? 0, {
        activationId: String(data)
      });
      details.shatterSpendCommitted = true;
    }
  },
  reactions: {
    'damage.resolved': resolveBladeCriticalTraits
  }
};
