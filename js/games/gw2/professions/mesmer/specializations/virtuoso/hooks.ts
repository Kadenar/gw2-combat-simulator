import { virtuosoBuffPolicies } from '#gw2/professions/mesmer/specializations/virtuoso/effect-state.js';
import { createMesmerActions } from '#gw2/professions/mesmer/family-mechanics.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { virtuosoAvailability } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/bladesongs.js';
import { startInfiniteForge } from '#gw2/professions/mesmer/specializations/virtuoso/traits/behavior.js';
import { resolveBladeCriticalTraits } from '#gw2/professions/mesmer/specializations/virtuoso/traits/behavior.js';
import { virtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/state.js';
import { boundedNumber } from '#kernel/core/numeric.js';
import { mesmerResourceDefinition } from '#gw2/professions/mesmer/family-state.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

/** Blade resources follow committed spending, accepted Bleeding, and actual shared critical outcomes. */
export const virtuosoHooks: RuntimeHooks<MesmerRuntimeState, MesmerSkill> = {
  buffPolicies: virtuosoBuffPolicies,
  // Seed the selected pool before initialization; only earned gains trigger illusion rewards.
  resources: {
    blades: {
      kind: 'continuous',
      state: (context) => virtuosoState.from(context).blades,
      maximum: (context) => mesmerResourceDefinition('Virtuoso', context).maximum,
      initial: (context, maximum) => boundedNumber(context.config.initialResource ?? 0, 0, 0, maximum),
      recovery: () => 0
    }
  },
  initialize: startInfiniteForge,
  availability: virtuosoAvailability,
  tasks: {
    'mesmer.blade-spend'(runtime, data) {
      const details = runtime.profession.core.castDetails.get(String(data));
      if (!details || details.shatterSpendCommitted) return;
      details.shatterSpent = createMesmerActions(runtime).commitReservedResources(
        runtime.time,
        details.shatterSpent ?? 0,
        {
          activationId: String(data)
        }
      );
      details.shatterSpendCommitted = true;
    }
  },
  reactions: {
    'damage.resolved': resolveBladeCriticalTraits
  }
};
