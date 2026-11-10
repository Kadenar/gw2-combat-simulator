/** Compose instrument and Tale owners with Troubadour's note resources and Dodge rewards. */
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { mesmerResourceDefinition } from '#gw2/professions/mesmer/family-state.js';
import { troubadourBuffPolicies } from '#gw2/professions/mesmer/specializations/troubadour/effect-state.js';
import { troubadourInstrumentLifecycle } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.js';
import { troubadourTaleLifecycle } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/tales.js';
import { troubadourDodgeCompleted } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/trigger-points.js';
import { troubadourState } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export const troubadourHooks = composeRuntimeHooks<MesmerRuntimeState, MesmerSkill>([
  troubadourTaleLifecycle,
  troubadourInstrumentLifecycle,
  {
    buffPolicies: troubadourBuffPolicies,
    // Seed the selected pool before initialization; only earned gains trigger illusion rewards.
    resources: {
      notes: {
        kind: 'continuous',
        state: (context) => troubadourState.from(context.profession).notes,
        maximum: (context) => mesmerResourceDefinition('Troubadour', context.helpers).maximum,
        initial: (context, maximum) => boundedNumber(context.config.initialResource ?? 0, 0, 0, maximum),
        recovery: () => 0
      }
    },
    initialize(runtime) {
      // Seed selected instrument ammo before accepting casts.
      for (const skill of runtime.helpers.skills) runtime.cooldownController.ensureAmmo(skill);
    },
    tasks: {
      'mesmer.troubadour.dodge'(runtime, data) {
        runtime.fireTrigger(troubadourDodgeCompleted, data as { cast: RuntimeCast<MesmerSkill> });
      }
    }
  }
]);
