import { emitThiefStateSnapshot } from '#gw2/professions/thief/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefCastContext, ThiefSkill } from '#gw2/professions/thief/types.js';
import { daredevilState } from '#gw2/professions/thief/specializations/daredevil/state.js';

import { DAREDEVIL_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/daredevil/profiles.js';

export function updatePalmStrikeWindow(context: ThiefCastContext, skill: ThiefSkill): void {
  if (context.action?.cancelled === true) return;
  const state = daredevilState.from(context);
  const flips = professionCoreState(context).availableFlips;
  if (skill.id === ID.FIST_FLURRY) {
    // Only a completed, on-target flurry opens the follow-up in both scheduling and the palette.
    if (context.action?.offTarget === true || context.effectiveEnd < context.fullEnd - context.epsilon) return;
    state.palmStrikeUntil =
      context.effectiveEnd + Number(balanceProfileFromContext(context, PROFILE.palmStrike)?.durationMultiplier ?? 5);
    flips[ID.PALM_STRIKE] = state.palmStrikeUntil;
    emitThiefStateSnapshot(context, context.effectiveEnd, 'palm-strike-ready');
  } else if (skill.id === ID.PALM_STRIKE) {
    // Consuming Palm Strike closes the window immediately so it cannot be cast twice
    state.palmStrikeUntil = 0;
    delete flips[ID.PALM_STRIKE];
    emitThiefStateSnapshot(context, context.effectiveEnd, 'palm-strike-used');
  }
}
