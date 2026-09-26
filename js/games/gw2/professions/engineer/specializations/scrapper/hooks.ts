import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { EngineerRuntimeState, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';
import { scrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';
import { scrapperMaximumAmmo } from '#gw2/professions/engineer/specializations/scrapper/traits/modifiers.js';
import { applyScrapperCastTraits } from '#gw2/professions/engineer/specializations/scrapper/traits/index.js';
import {
  scrapperResolverEventReactions,
  triggerMassMomentum
} from '#gw2/professions/engineer/specializations/scrapper/traits/reactions.js';

/** Actual combo results grant Kinetic Accelerators once; one pending pulse rechecks live Stability. */
export const scrapperHooks: Partial<RuntimeProfession<EngineerRuntimeState>> = {
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
