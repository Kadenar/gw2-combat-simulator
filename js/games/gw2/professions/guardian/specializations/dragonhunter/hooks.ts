import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { timedBuffWindow } from '#gw2/platform/combat/effect-state.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { dragonhunterControlAccepted } from '#gw2/professions/guardian/specializations/dragonhunter/mechanics/trigger-points.js';
import { dragonhunterVirtueLifecycle } from '#gw2/professions/guardian/specializations/dragonhunter/mechanics/virtue-effects.js';
import { dragonhunterState } from '#gw2/professions/guardian/specializations/dragonhunter/state.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

/** Register the virtue lifecycle and retain control notifications at the specialization boundary. */
export const dragonhunterHooks = composeRuntimeHooks<GuardianRuntimeState, GuardianSkill>([
  dragonhunterVirtueLifecycle,
  {
    // Big Game Hunter follows the Spear of Justice tether, including early release.
    observeEffects: (runtime) => [
      timedBuffWindow(
        'spear-of-justice-tether',
        hasTrait(runtime, TRAIT.BIG_GAME_HUNTER)
          ? 'Spear of Justice tether (Big Game Hunter)'
          : 'Spear of Justice tether',
        dragonhunterState.from(runtime.profession).tetherUntil
      )
    ],
    reactions: {
      'control.resolved'(runtime, event) {
        if (event.actorType === ACTOR.PLAYER) runtime.fireTrigger(dragonhunterControlAccepted, { cause: event });
      }
    }
  }
]);
