import { replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { performRevenantDodge } from '#gw2/professions/revenant/core/execution/actions.js';
import { VINDICATOR_AIRBORNE_MS } from '#gw2/professions/revenant/specializations/vindicator/skills/dodge-skills.js';
import type { RevenantCastContext } from '#gw2/professions/revenant/types.js';
import { completeVindicatorDodge } from '#gw2/professions/revenant/specializations/vindicator/mechanics/dodge.js';

/** Applies Vindicator state changes after the native cast lifecycle completes. */
export const vindicatorSkillHandlers = new Map(
  Object.entries(
    Object.freeze({
      // Spend endurance at takeoff; resolve the selected attack only when the full jump reaches its landing.
      'revenant.vindicator-jump': replaceSkill<RevenantCastContext>({
        beforeEffects: (context, skill) => performRevenantDodge(context, skill, 'dodge-jump'),
        afterEffects: (context, skill) => {
          // Takeoff still spends endurance, but cancellation prevents the landing package.
          if (!context.action.cancelled)
            completeVindicatorDodge(context, skill, context.start + VINDICATOR_AIRBORNE_MS / 1000);
        }
      })
    })
  )
);
