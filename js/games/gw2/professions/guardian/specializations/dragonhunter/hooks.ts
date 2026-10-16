import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { dragonhunterControlAccepted } from '#gw2/professions/guardian/specializations/dragonhunter/mechanics/activations.js';
import { dragonhunterVirtueLifecycle } from '#gw2/professions/guardian/specializations/dragonhunter/mechanics/virtue-effects.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

/** Register the virtue lifecycle and retain control notifications at the specialization boundary. */
export const dragonhunterHooks: RuntimeHooks<GuardianRuntimeState, GuardianSkill> = {
  ...dragonhunterVirtueLifecycle,
  reactions: {
    ...dragonhunterVirtueLifecycle.reactions,
    'control.resolved'(runtime, event) {
      if (event.actorType === 'player') runtime.fireTrigger(dragonhunterControlAccepted, { cause: event });
    }
  }
};
