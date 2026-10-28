import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { registerElementalistEliteEvents } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import {
  catalystBuffPolicies,
  catalystEffectStates
} from '#gw2/professions/elementalist/specializations/catalyst/effect-state.js';
import {
  applyCatalystResolvedDamage,
  applyShatteringIce
} from '#gw2/professions/elementalist/specializations/catalyst/mechanics/reactions.js';
import {
  catalystEnergyPolicy,
  gainCatalystEnergy
} from '#gw2/professions/elementalist/specializations/catalyst/mechanics/resources.js';
import {
  catalystCombatStarted,
  catalystTransitionObserved
} from '#gw2/professions/elementalist/specializations/catalyst/mechanics/trigger-points.js';
import { catalystAugmentLifecycle } from '#gw2/professions/elementalist/specializations/catalyst/skills/augment-skills.js';
import {
  catalystSphereLifecycle,
  modifyJadeSphereEffects
} from '#gw2/professions/elementalist/specializations/catalyst/skills/jade-sphere.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

// Resource policies initialize energy first; retain the actual attunement notification for trait rewards.
function initialize(context: ElementalistRuntime): void {
  registerElementalistEliteEvents(context, (runtime, event) => {
    runtime.fireTrigger(catalystTransitionObserved, { event });
  });
}

/** Compose resource and skill owners; accepted-hit energy gains precede Catalyst trait reactions. */
export const catalystHooks = composeRuntimeHooks<ElementalistRuntimeState, ElementalistSkill>([
  catalystSphereLifecycle,
  catalystAugmentLifecycle,
  {
    buffPolicies: catalystBuffPolicies,
    observeEffects: catalystEffectStates,
    resources: { catalystEnergy: catalystEnergyPolicy },
    initialize,
    // Publish combat entry so selection and isolation govern admission of trait renewal loops.
    onCombatStart(runtime) {
      runtime.fireTrigger(catalystCombatStarted);
    },
    modifyEffects(runtime, cast, effects) {
      // Augment actions sample live conditions at commitment instead of materializing effects at cast start.
      if (cast.skill.sideEffects?.some((effect) => effect.do.type === 'elementalist.catalyst.augment-window'))
        return [];

      return modifyJadeSphereEffects(runtime, cast, effects);
    },

    reactions: {
      'damage.resolved'(runtime, event) {
        gainCatalystEnergy(runtime, event);
        applyCatalystResolvedDamage(runtime, event);
      },
      'buff.applied': applyShatteringIce
    }
  }
]);
