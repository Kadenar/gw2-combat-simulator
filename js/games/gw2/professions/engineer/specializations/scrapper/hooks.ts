import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { SCRAPPER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/scrapper/profiles.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { EngineerRuntimeState, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';
import { scrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';
import { scrapperMaximumAmmo } from '#gw2/professions/engineer/specializations/scrapper/traits/ex-machina.js';
import { applyScrapperCastTraits } from '#gw2/professions/engineer/specializations/scrapper/traits/index.js';
import {
  scrapperResolverEventReactions,
  triggerMassMomentum
} from '#gw2/professions/engineer/specializations/scrapper/traits/reactions.js';

/** Actual combo results grant Kinetic Accelerators once; one pending pulse rechecks live Stability. */
export const scrapperHooks: Partial<RuntimeProfession<EngineerRuntimeState>> = {
  // Function Gyro's Stability seeds the existing live Stability pulse loop.
  traitTriggers: [
    {
      trait: TRAIT.MASS_MOMENTUM,
      on: 'castComplete',
      when: (_runtime, cast) => cast.skill.id === ID.FUNCTION_GYRO,
      emit: PROFILE.massMomentum,
      effects: (effect) => effect.type === 'boon' && effect.name === 'stability',
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.MASS_MOMENTUM,
        actorType: 'player',
        name: 'Mass Momentum — stability'
      }
    }
  ],
  maximumAmmo: scrapperMaximumAmmo,
  onCastComplete(runtime, cast) {
    if (!castWasInterrupted(cast)) applyScrapperCastTraits(runtime, cast);
  },
  tasks: {
    'engineer.mass-momentum'(runtime, data) {
      const state = scrapperState.from(runtime);
      if (state.massMomentumAt !== runtime.time) return;
      state.massMomentumAt = Infinity;
      triggerMassMomentum(runtime, { ...(data as EngineerResolverEvent), at: runtime.time });
    }
  },
  reactions: {
    'damage.resolved': scrapperResolverEventReactions.damage,
    'buff.applied': scrapperResolverEventReactions.buff,
    'combo.resolved': scrapperResolverEventReactions.combo
  }
};
